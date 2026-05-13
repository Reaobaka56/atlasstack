"""
Analysis Orchestrator
Decouples repository analysis logic from FastAPI routers.
"""

import os
import tempfile
import shutil
import uuid
import git
import json
import re
import asyncio
import structlog
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor
from huggingface_hub import AsyncInferenceClient
import google.generativeai as genai

from services.analysis.engine.architecture_mapper import get_mapper
from services.analysis.engine.dependency_analyzer import get_dependency_analyzer
from services.analysis.engine.security_scanner import get_scanner
from services.analysis.core.collector import TrainingDataCollector
from shared.utils.llm import call_llm_with_retry

DEFAULT_MODEL = "Qwen/Qwen2.5-Coder-7B-Instruct"
logger = structlog.get_logger()
_executor = ThreadPoolExecutor(max_workers=4)

class AnalysisOrchestrator:
    """
    The central coordinator for repository analysis.
    
    This class orchestrates the lifecycle of an analysis task:
    1. Cloning remote repositories (with security guardrails).
    2. Extracting file trees and key file contents.
    3. Calling LLM providers (Gemini or HuggingFace) with structured prompts.
    4. Running local analysis engines (AST mapping, dependency scanning).
    5. Aggregating results and calculating metrics like tech debt.
    """
    def __init__(self, hf_token: str = None, gemini_key: str = None):
        self.hf_token = hf_token or os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")
        self.gemini_key = gemini_key or os.environ.get("GEMINI_API_KEY")
        self.openrouter_key = os.environ.get("OPENROUTER_API_KEY")
        self.default_model = os.environ.get("DEFAULT_MODEL", DEFAULT_MODEL)
        
        # 🟢 CRITICAL: Prioritize Hugging Face/OpenRouter as the primary engine
        # We only use Gemini as a secondary fallback or if explicitly configured without HF
        if self.gemini_key and not self.hf_token:
            genai.configure(api_key=self.gemini_key)
            self.gemini_model = genai.GenerativeModel('gemini-1.5-flash')
        else:
            self.gemini_model = None

        self.mapper = get_mapper()
        self.dep_analyzer = get_dependency_analyzer()
        self.scanner = get_scanner()
        self.collector = TrainingDataCollector()

    async def analyze_repository(self, repo_url: str, is_local: bool = False, github_token: str = None) -> dict:
        """
        Analyze a repository (remote or local).
        
        Args:
            repo_url: The URL or local path to the repository.
            is_local: If True, treats repo_url as a local path.
            github_token: Optional token for private repository access.
            
        Returns:
            A structured dictionary containing:
                - explanation: Summary and ELI5 explanation.
                - architecture: System architecture map.
                - security_report: Dependency risk analysis.
                - tech_debt_score: Calculated maintainability score.
                - fixes: Suggested code improvements.
        """
        if not self.hf_token and not self.gemini_key:
            return self._get_mock_response("Missing AI tokens (HF or Gemini).")

        if is_local:
            return await self._run_analysis(repo_url, repo_url)
        
        # Remote repo handling
        # 🟢 SECURITY: Strict URL validation to prevent injection attacks
        repo_regex = r'^(https?:\/\/)?(www\.)?(github\.com|gitlab\.com|bitbucket\.org)\/[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+(\.git)?\/?$'
        if not re.match(repo_regex, repo_url):
            logger.error(f"Insecure or invalid repo URL blocked: {repo_url}")
            return self._get_error_response("Invalid repository URL format. Only standard GitHub/GitLab/Bitbucket URLs are allowed.")

        # Prepare authenticated URL if token is provided
        cloning_url = repo_url
        if github_token and "github.com" in repo_url:
            cloning_url = repo_url.replace("https://github.com/", f"https://x-access-token:{github_token}@github.com/")

        temp_dir = tempfile.mkdtemp()
        try:
            logger.info(f"Cloning {repo_url} into {temp_dir}")
            loop = asyncio.get_event_loop()
            # Enforce 30 second timeout for cloning
            await asyncio.wait_for(
                loop.run_in_executor(
                    _executor,
                    lambda: git.Repo.clone_from(cloning_url, temp_dir, depth=1, single_branch=True)
                ),
                timeout=30.0
            )
            
            # Basic size check (prevent zip bombs or massive repos)
            total_size = 0
            for root, dirs, files in os.walk(temp_dir):
                for f in files:
                    fp = os.path.join(root, f)
                    total_size += os.path.getsize(fp)
                    if total_size > 100 * 1024 * 1024: # 100MB limit
                        raise ValueError("Repository too large for analysis (>100MB)")

            return await self._run_analysis(temp_dir, repo_url)
        except asyncio.TimeoutError:
            logger.error(f"Clone timed out for {repo_url}")
            return self._get_error_response("Repository clone timed out (max 30s)")
        except Exception as e:
            logger.error(f"Analysis failed: {e}")
            return self._get_error_response(str(e))
        finally:
            if not is_local:
                shutil.rmtree(temp_dir, ignore_errors=True)

    async def _run_analysis(self, path: str, display_name: str) -> dict:
        """Core analysis engine for a directory path."""
        file_tree = []
        key_contents = {}
        
        # Scan files for context
        for root, dirs, files in os.walk(path):
            if '.git' in dirs: dirs.remove('.git')
            if 'node_modules' in dirs: dirs.remove('node_modules')
            if '__pycache__' in dirs: dirs.remove('__pycache__')
                
            for file in files:
                rel_path = os.path.relpath(os.path.join(root, file), path)
                file_tree.append(rel_path)
                
                # Capture important file contents for LLM context
                if file in ['package.json', 'README.md', 'index.js', 'app.js', 'server.js', 'main.py', 'requirements.txt', 'docker-compose.yml', 'vite.config.ts']:
                    try:
                        with open(os.path.join(root, file), 'r', encoding='utf-8') as f:
                            key_contents[rel_path] = f.read()[:2000]
                    except: pass
        
        instruction, input_context = self._build_prompt(display_name, file_tree, key_contents)
        prompt = f"{instruction}\n\n{input_context}"
        
        content = ""
        try:
            if self.gemini_model:
                logger.info("Using Gemini for analysis")
                # 🟡 TIMEOUT: Enforce 120 second limit on LLM generation
                response = await asyncio.wait_for(
                    asyncio.to_thread(lambda: self.gemini_model.generate_content(prompt)),
                    timeout=120.0
                )
                content = response.text
            else:
                logger.info(f"Using Hugging Face / OpenRouter for analysis with model: {self.default_model}")
                # If OpenRouter is available, we use its base URL
                base_url = "https://openrouter.ai/api/v1" if self.openrouter_key else None
                client = AsyncInferenceClient(api_key=self.openrouter_key or self.hf_token, base_url=base_url)
                
                try:
                    # 🟡 TIMEOUT: Enforce 120 second limit on LLM generation
                    response = await asyncio.wait_for(
                        call_llm_with_retry(
                            client=client,
                            model=self.default_model, 
                            messages=[{"role": "user", "content": prompt}], 
                            max_tokens=3000,
                            temperature=0.1
                        ),
                        timeout=120.0
                    )
                except Exception as e:
                    # 🚀 AUTO-RECOVERY: If 32B or other model 404s, force 7B and retry
                    if ("404" in str(e) or "400" in str(e) or "Not Found" in str(e) or "Bad Request" in str(e)) and self.default_model != "Qwen/Qwen2.5-Coder-7B-Instruct":
                        logger.warning(f"Model {self.default_model} not found. Auto-recovering with 7B model...")
                        response = await asyncio.wait_for(
                            call_llm_with_retry(
                                client=client,
                                model="Qwen/Qwen2.5-Coder-7B-Instruct", 
                                messages=[{"role": "user", "content": prompt}], 
                                max_tokens=3000,
                                temperature=0.1
                            ),
                            timeout=120.0
                        )
                    else:
                        raise e

                if hasattr(response, 'choices'):
                    content = response.choices[0].message.content
                else:
                    # Fallback for raw HF response if not using chat completions
                    content = response
        except asyncio.TimeoutError:
            logger.error("LLM generation timed out")
            raise ValueError("AI analysis timed out (max 120s). Try a smaller repository.")
        except Exception as e:
            logger.error(f"LLM generation failed: {e}")
            raise ValueError(f"AI analysis failed: {str(e)}")

        result_json = self._parse_json(content)
        
        # Collect for training
        self.collector.collect(
            instruction=instruction,
            input_data=input_context,
            output_data=result_json,
            metadata={"repo_url": display_name, "model": self.default_model}
        )
        
        # Enhance with local engine data
        try:
            result_json["architecture"] = self.mapper.map_repository(path)
        except Exception as e:
            logger.error(f"Architecture mapping failed: {e}")
            result_json["architecture"] = {"error": str(e), "nodes": [], "edges": []}
        
        try:
            deps = self.dep_analyzer.scan_project(path)
            result_json["security_report"] = {
                "dependencies": [{
                    "name": d.name, 
                    "version": d.version, 
                    "risk_score": d.risk_score,
                    "risk_factors": d.risk_factors,
                    "vulnerabilities": d.vulnerabilities
                } for d in deps],
                "overall_risk": sum(d.risk_score for d in deps) / len(deps) if deps else 0
            }
        except Exception as e:
            logger.error(f"Dependency analysis failed: {e}")
            result_json["security_report"] = {"error": str(e), "dependencies": [], "overall_risk": 0}
        
        # Calculate tech debt
        vuln_count = len(result_json.get("security_report", {}).get("dependencies", []))
        fix_count = len(result_json.get("fixes", []))
        base_debt = 100 - result_json.get("health_score", 50)
        tech_debt_score = min(100, base_debt + (vuln_count * 5) + (fix_count * 2))
        
        if tech_debt_score < 20: maturity = "Elite"
        elif tech_debt_score < 40: maturity = "Standard"
        elif tech_debt_score < 70: maturity = "Legacy"
        else: maturity = "Critical Debt"
        
        result_json["tech_debt_score"] = tech_debt_score
        result_json["maturity_level"] = maturity
        
        return result_json

    def _build_prompt(self, repo_url: str, file_tree: list, key_contents: dict) -> tuple[str, str]:
        instruction = """
        You are an expert software architect analyzing a codebase.
        Analyze this repository and return a structured JSON with ONLY the following format:
        {
            "explanation": {
                "summary": "Full summary in 2-3 sentences.",
                "eli5_summary": "Engaging fun analogy explanation for a 10-year-old.",
                "entry_point": "Main entry file.",
                "architecture": "Overview of layout.",
                "data_flow": "Detailed data flow explanation."
            },
            "important_files": [
                {"path": "file_path.ext", "reason": "Why it's important", "is_start_here": true}
            ],
            "fixes": [
                {
                    "problem": "Issue description", 
                    "eli5_explanation": "Junior dev explanation",
                    "file_path": "target_file.js", 
                    "code_add": "Code to add", 
                    "code_remove": "Code to remove"
                }
            ],
            "errors": ["Warnings/missing deps"],
            "run_steps": ["Shell commands"],
            "health_score": <0-100>,
            "dependencies": [
                {"name": "name", "purpose": "explanation"}
            ],
            "tech_stack": {
                "frameworks": ["Detected"],
                "databases": ["Detected"]
            }
        }
        Return absolute pure JSON.
        """.strip()
        
        input_context = f"Repository: {repo_url}\nFiles: {file_tree[:150]}\nKey Content: {str(key_contents)[:4000]}"
        
        return instruction, input_context

    def _parse_json(self, content: str) -> dict:
        match = re.search(r'```(?:json)?\s*(.*?)\s*```', content, re.DOTALL)
        json_str = match.group(1) if match else content
        try:
            return json.loads(json_str)
        except:
            return {"error": "Failed to parse LLM response", "raw": content}

    def _get_mock_response(self, message: str) -> dict:
        return {
            "explanation": {"summary": message, "eli5_summary": "No AI keys!"},
            "important_files": [],
            "fixes": [],
            "errors": [message],
            "run_steps": [],
            "health_score": 0,
            "dependencies": [],
            "tech_stack": {"frameworks": [], "databases": []}
        }

    def _get_error_response(self, error):
        return {
            "explanation": {"summary": f"Error during analysis: {error}", "eli5_summary": "Something went wrong while scanning the codebase."},
            "important_files": [],
            "fixes": [],
            "errors": [str(error)],
            "run_steps": [],
            "health_score": 0,
            "dependencies": [],
            "tech_stack": {"frameworks": [], "databases": []}
        }
