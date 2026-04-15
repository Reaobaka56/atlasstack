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
from huggingface_hub import InferenceClient

from services.analysis.engine.architecture_mapper import get_mapper
from services.analysis.engine.dependency_analyzer import get_dependency_analyzer
from services.analysis.engine.security_scanner import get_scanner
from services.analysis.core.collector import TrainingDataCollector
from shared.utils.llm import call_llm_with_retry

logger = structlog.get_logger()
_executor = ThreadPoolExecutor(max_workers=4)

class AnalysisOrchestrator:
    def __init__(self, hf_token: str = None):
        self.hf_token = hf_token or os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")
        self.default_model = os.environ.get("DEFAULT_MODEL", "Qwen/Qwen2.5-Coder-32B-Instruct")
        self.mapper = get_mapper()
        self.dep_analyzer = get_dependency_analyzer()
        self.scanner = get_scanner()
        self.collector = TrainingDataCollector()

    async def analyze_repository(self, repo_url: str, is_local: bool = False) -> dict:
        """
        Analyze a repository (remote or local).
        Returns a structured dictionary of results.
        """
        if not self.hf_token:
            return self._get_mock_response("Missing Hugging Face token.")

        if is_local:
            return await self._run_analysis(repo_url, repo_url)
        
        # Remote repo handling
        temp_dir = tempfile.mkdtemp()
        try:
            logger.info(f"Cloning {repo_url} into {temp_dir}")
            loop = asyncio.get_event_loop()
            await loop.run_in_executor(
                _executor,
                lambda: git.Repo.clone_from(repo_url, temp_dir, depth=1)
            )
            return await self._run_analysis(temp_dir, repo_url)
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
        
        client = InferenceClient(api_key=self.hf_token, provider="auto")
        response = await call_llm_with_retry(
            client=client,
            model=self.default_model, 
            messages=[{"role": "user", "content": prompt}], 
            max_tokens=3000,
            temperature=0.1
        )
        
        content = response.choices[0].message.content
        result_json = self._parse_json(content)
        
        # Collect for training
        self.collector.collect(
            instruction=instruction,
            input_data=input_context,
            output_data=result_json,
            metadata={"repo_url": display_name, "model": self.default_model}
        )
        
        # Enhance with local engine data
        result_json["architecture"] = self.mapper.map_repository(path)
        
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

    def _build_prompt(self, repo_url, file_tree, key_contents):
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

    def _parse_json(self, content):
        match = re.search(r'```(?:json)?\s*(.*?)\s*```', content, re.DOTALL)
        json_str = match.group(1) if match else content
        try:
            return json.loads(json_str)
        except:
            return {"error": "Failed to parse LLM response", "raw": content}

    def _get_mock_response(self, message):
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
            "explanation": {"summary": f"Error: {error}"},
            "errors": [error],
            "health_score": 0
        }
