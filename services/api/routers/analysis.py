"""
Analysis endpoints
"""

from typing import List, Optional
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from datetime import datetime
from core.database import get_db, AnalysisRecord
from core.github_client import get_github_client
from middleware.auth import PermissionChecker

logger = structlog.get_logger()
router = APIRouter()


# Pydantic models
class CodeSnippet(BaseModel):
    code: str = Field(..., min_length=1, max_length=100000)
    language: str
    filename: Optional[str] = None


class AnalysisOptions(BaseModel):
    include_suggestions: bool = True
    include_explanations: bool = True
    severity_threshold: str = "low"
    max_findings: int = 100


class AnalysisRequest(BaseModel):
    snippet: CodeSnippet
    analysis_types: List[str] = Field(default_factory=lambda: ["security", "performance"])
    options: AnalysisOptions = Field(default_factory=AnalysisOptions)


class MVPAnalysisRequest(BaseModel):
    repo_url: str
    save_result: bool = True  # persist to DB

class MVPAnalysisResponse(BaseModel):
    explanation: dict
    important_files: list
    fixes: list
    errors: list
    run_steps: list
    health_score: int
    dependencies: list
    tech_stack: dict
    architecture: Optional[dict] = None
    security_report: Optional[dict] = None
    tech_debt_score: int = 0
    maturity_level: str = "Unknown"
    forecast: Optional[dict] = None # Predicted maintenance cost
    security_report: Optional[dict] = None
    architecture: Optional[dict] = None


class Finding(BaseModel):
    id: str
    type: str
    severity: str
    message: str
    line_start: int
    line_end: int
    column_start: Optional[int]
    column_end: Optional[int]
    file_path: Optional[str]
    code_snippet: Optional[str]
    suggestion: Optional[str]
    explanation: Optional[str]
    cwe_id: Optional[str]
    confidence: float


class AnalysisMetrics(BaseModel):
    complexity_score: Optional[float]
    maintainability_index: Optional[float]
    lines_of_code: int
    cyclomatic_complexity: Optional[int]
    cognitive_complexity: Optional[int]


class AnalysisResponse(BaseModel):
    id: UUID
    status: str
    analysis_types: List[str]
    findings: List[Finding]
    metrics: Optional[AnalysisMetrics]
    summary: dict
    completed_at: Optional[str]
    duration_ms: Optional[int]


class BatchAnalysisRequest(BaseModel):
    snippets: List[CodeSnippet]
    analysis_types: List[str] = Field(default_factory=lambda: ["security", "performance"])


# Mock analysis results for demo
mock_findings = [
    {
        "id": "finding-001",
        "type": "security",
        "severity": "high",
        "message": "Potential SQL injection vulnerability detected",
        "line_start": 15,
        "line_end": 15,
        "column_start": 20,
        "column_end": 45,
        "file_path": "src/database.py",
        "code_snippet": 'query = f"SELECT * FROM users WHERE id = {user_id}"',
        "suggestion": "Use parameterized queries: cursor.execute('SELECT * FROM users WHERE id = ?', (user_id,))",
        "explanation": "String interpolation in SQL queries can lead to SQL injection attacks.",
        "cwe_id": "CWE-89",
        "confidence": 0.95,
    },
    {
        "id": "finding-002",
        "type": "performance",
        "severity": "medium",
        "message": "Inefficient list concatenation in loop",
        "line_start": 42,
        "line_end": 44,
        "column_start": 8,
        "column_end": 25,
        "file_path": "src/processing.py",
        "code_snippet": "result = []\nfor item in items:\n    result = result + [process(item)]",
        "suggestion": "Use list.append() or list comprehension for better performance",
        "explanation": "Using + to concatenate lists creates a new list each iteration, O(n^2) complexity.",
        "cwe_id": None,
        "confidence": 0.88,
    },
]


@router.post("/analysis/mvp", response_model=MVPAnalysisResponse)
async def analyze_mvp(request: MVPAnalysisRequest, req: Request = None, db: AsyncSession = Depends(get_db)):
    """MVP Endpoint for full repository analysis - with DB persistence"""
    import os
    import tempfile
    import shutil
    import uuid
    from huggingface_hub import InferenceClient
    from sqlalchemy import select
    import git
    import json
    import re
    from services.analysis.engine.architecture_mapper import get_mapper
    from services.analysis.engine.dependency_analyzer import get_dependency_analyzer
    from services.analysis.engine.security_scanner import get_scanner

    analysis_id = str(uuid.uuid4())
    # Extract user from request state if authenticated
    user_id = "anonymous"
    if req:
        user = getattr(req.state, "user", None)
        if user:
            user_id = user.get("id", "anonymous")

    # Save initial record
    if request.save_result:
        record = AnalysisRecord(
            id=analysis_id,
            repo_id=analysis_id,
            user_id=user_id,
            repo_url=request.repo_url,
            status="running",
        )
        db.add(record)
        await db.commit()
    
    hf_token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")
    
    # Check if key exists
    if not hf_token:
        logger.warning("No Hugging Face token found. Falling back to mock MVP response.")
        return MVPAnalysisResponse(
            explanation={
                "summary": "This is a placeholder summary. Set HF_TOKEN to see real results.",
                "eli5_summary": "Imagine a big box of legos, but it's empty right now because we need an API key!",
                "entry_point": "index.js",
                "architecture": "Client-Server",
                "data_flow": "Request -> Server -> Response"
            },
            important_files=[{"path": "package.json", "reason": "Dependencies", "is_start_here": True}],
            fixes=[{"problem": "Missing HF_TOKEN", "eli5_explanation": "Imagine your backend is a car. The HF_TOKEN is the keys! Without it, we can't drive the AI and run our powerful engine. We just need to add the keys to the .env ignition.", "file_path": ".env", "code_add": "HF_TOKEN=your_token_here", "code_remove": ""}],
            errors=["Missing Hugging Face API Key in backend .env"],
            run_steps=["Add HF_TOKEN to .env", "Restart uvicorn main:app"],
            health_score=10,
            dependencies=[{"name": "huggingface_hub", "purpose": "Connects to AI"}],
            tech_stack={"frameworks": ["Unknown"], "databases": ["Unknown"]}
        )
        
    temp_dir = tempfile.mkdtemp()
    try:
        logger.info(f"Cloning {request.repo_url} into {temp_dir}")
        git.Repo.clone_from(request.repo_url, temp_dir, depth=1)
        
        file_tree = []
        key_contents = {}
        for root, dirs, files in os.walk(temp_dir):
            if '.git' in dirs:
                dirs.remove('.git')
            if 'node_modules' in dirs:
                dirs.remove('node_modules')
                
            for file in files:
                rel_path = os.path.relpath(os.path.join(root, file), temp_dir)
                file_tree.append(rel_path)
                
                if file in ['package.json', 'README.md', 'index.js', 'app.js', 'server.js', 'main.py', 'requirements.txt', 'docker-compose.yml', 'vite.config.ts'] or getattr(request, 'is_mock', False):
                    try:
                        with open(os.path.join(root, file), 'r', encoding='utf-8') as f:
                            key_contents[rel_path] = f.read()[:2000] # limit size
                    except Exception:
                        pass
        
        prompt = f"""
        You are an expert software architect analyzing a codebase.
        Repository URL: {request.repo_url}
        Files: {file_tree[:150]}...
        Key Content: {str(key_contents)[:4000]}
        
        Analyze this repository and return a structured JSON with ONLY the following format. Ensure nothing else is provided outside the JSON block:
        {{
            "explanation": {{
                "summary": "What this app does completely and accurately in 2-3 sentences.",
                "eli5_summary": "Explain how this app works to a 10-year-old using highly engaging fun analogies.",
                "entry_point": "The main entry file (e.g. server.js, index.js, main.py)",
                "architecture": "Overview of frontend, backend, and db layout.",
                "data_flow": "Detailed explanation of how data flows from request to response."
            }},
            "important_files": [
                {{"path": "file_path.ext", "reason": "Why it's important", "is_start_here": true}}
            ],
            "fixes": [
                {{
                    "problem": "Brief description of issue (e.g. missing middleware, missing script)", 
                    "eli5_explanation": "Explain this exact issue and why it needs fixing like I'm a junior dev",
                    "file_path": "target_file.js", 
                    "code_add": "Exact code to add or replace", 
                    "code_remove": "Code to remove if applicable"
                }}
            ],
            "errors": ["List of missing dependencies, missing env vars, or serious warnings"],
            "run_steps": ["Exact shell command 1 like 'npm install'", "Exact shell command 2"],
            "health_score": <number between 0 and 100 based on structure and quality>,
            "dependencies": [
                {{"name": "depend_name", "purpose": "Short explanation of what it does"}}
            ],
            "tech_stack": {{
                "frameworks": ["Detected Framework 1"],
                "databases": ["Detected Database 1"]
            }}
        }}

        Be extremely specific and practical. Return absolute pure JSON.
        """
        
        client = InferenceClient(api_key=hf_token)
        messages = [{"role": "user", "content": prompt}]
        
        # Using a reliable, open instruction model suitable for coding and JSON
        response = client.chat.completions.create(
            model="Qwen/Qwen2.5-Coder-32B-Instruct", 
            messages=messages, 
            max_tokens=2000,
            temperature=0.1
        )
        
        content = response.choices[0].message.content
        
        # Clean up response to find json blocks
        match = re.search(r'```(?:json)?\s*(.*?)\s*```', content, re.DOTALL)
        if match:
            json_str = match.group(1)
        else:
            json_str = content
            
        result_json = json.loads(json_str)
        
        # --- PHASE 1 ENHANCEMENTS ---
        # 1. Architecture Mapping
        mapper = get_mapper()
        arch_data = mapper.map_repository(temp_dir)
        result_json["architecture"] = arch_data
        
        # 2. Dependency Risk Analysis
        dep_analyzer = get_dependency_analyzer()
        deps = dep_analyzer.scan_project(temp_dir)
        result_json["security_report"] = {
            "dependencies": [ {
                "name": d.name, 
                "version": d.version, 
                "risk_score": d.risk_score,
                "risk_factors": d.risk_factors,
                "vulnerabilities": d.vulnerabilities
            } for d in deps ],
            "overall_risk": sum(d.risk_score for d in deps) / len(deps) if deps else 0
        }
        
        # 4. Tech Debt & Maturity (Hybrid Calculation)
        # Formula: Base from AI health score, adjusted by count of real vulns and fixes
        vuln_count = len(result_json.get("security_report", {}).get("dependencies", []))
        fix_count = len(result_json.get("fixes", []))
        
        # Tech Debt Score (0-100, 100 is worst)
        # We invert health score and add penalties
        base_debt = 100 - result_json.get("health_score", 50)
        penalty = (vuln_count * 5) + (fix_count * 2)
        tech_debt_score = min(100, base_debt + penalty)
        
        # Maturity Level
        if tech_debt_score < 20: maturity = "Elite"
        elif tech_debt_score < 40: maturity = "Standard"
        elif tech_debt_score < 70: maturity = "Legacy"
        else: maturity = "Critical Debt"
        
        result_json["tech_debt_score"] = tech_debt_score
        result_json["maturity_level"] = maturity
        
        parsed = MVPAnalysisResponse(**result_json)

        # Persist result to DB
        if request.save_result:
            record.status = "completed"
            record.health_score = parsed.health_score
            record.tech_debt_score = parsed.tech_debt_score
            record.maturity_level = parsed.maturity_level
            record.summary = parsed.explanation.get("summary", "") if isinstance(parsed.explanation, dict) else ""
            record.eli5_summary = parsed.explanation.get("eli5_summary", "") if isinstance(parsed.explanation, dict) else ""
            record.tech_stack = parsed.tech_stack if isinstance(parsed.tech_stack, dict) else {}
            record.important_files = parsed.important_files
            record.fixes = parsed.fixes
            record.dependencies = parsed.dependencies
            record.errors = parsed.errors
            record.run_steps = parsed.run_steps
            record.architecture = parsed.architecture
            record.security_report = parsed.security_report
            record.completed_at = datetime.utcnow()
            await db.commit()

        return parsed

    except Exception as e:
        logger.error(f"MVP Analysis failed: {e}")
        return MVPAnalysisResponse(
            explanation={
                "summary": f"Failed to analyze repository: {str(e)}",
                "eli5_summary": "The robot got confused reading your code!",
                "entry_point": "Unknown",
                "architecture": "Unknown",
                "data_flow": "Unknown"
            },
            important_files=[],
            fixes=[],
            errors=[f"Analysis exception: {str(e)}"],
            run_steps=[],
            health_score=0,
            dependencies=[],
            tech_stack={"frameworks": [], "databases": []}
        )
    finally:
        shutil.rmtree(temp_dir, ignore_errors=True)


@router.post("/analyze", response_model=AnalysisResponse)
async def analyze_code(
    request: AnalysisRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(PermissionChecker(["user"])),
):
    """Analyze a code snippet"""
    import uuid
    from datetime import datetime

    analysis_id = uuid.uuid4()
    start_time = datetime.utcnow()

    logger.info(
        "Analysis requested",
        analysis_id=str(analysis_id),
        language=request.snippet.language,
        analysis_types=request.analysis_types,
    )

    # This would call the analysis service in production
    # For demo, return mock results
    findings = [Finding(**f) for f in mock_findings if f["type"] in request.analysis_types]

    completed_at = datetime.utcnow()
    duration_ms = int((completed_at - start_time).total_seconds() * 1000)

    # Calculate summary
    severity_counts = {"high": 0, "medium": 0, "low": 0, "info": 0}
    type_counts = {"security": 0, "performance": 0, "quality": 0}

    for finding in findings:
        severity_counts[finding.severity] = severity_counts.get(finding.severity, 0) + 1
        type_counts[finding.type] = type_counts.get(finding.type, 0) + 1

    return AnalysisResponse(
        id=analysis_id,
        status="completed",
        analysis_types=request.analysis_types,
        findings=findings,
        metrics=AnalysisMetrics(
            complexity_score=7.5,
            maintainability_index=82.3,
            lines_of_code=len(request.snippet.code.split("\n")),
            cyclomatic_complexity=12,
            cognitive_complexity=8,
        ),
        summary={
            "total_findings": len(findings),
            "severity_counts": severity_counts,
            "type_counts": type_counts,
        },
        completed_at=completed_at.isoformat(),
        duration_ms=duration_ms,
    )


@router.post("/analyze/batch")
async def analyze_batch(
    request: BatchAnalysisRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(PermissionChecker(["user"])),
):
    """Analyze multiple code snippets"""
    import uuid
    from datetime import datetime

    batch_id = uuid.uuid4()

    logger.info(
        "Batch analysis requested",
        batch_id=str(batch_id),
        snippet_count=len(request.snippets),
    )

    results = []
    for snippet in request.snippets:
        # Mock analysis for each snippet
        results.append(
            {
                "filename": snippet.filename,
                "language": snippet.language,
                "findings_count": 2,
                "status": "completed",
            }
        )

    return {
        "batch_id": str(batch_id),
        "status": "completed",
        "results": results,
        "completed_at": datetime.utcnow().isoformat(),
    }


@router.get("/analysis/{analysis_id}", response_model=AnalysisResponse)
async def get_analysis_result(
    analysis_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(PermissionChecker(["user"])),
):
    """Get analysis results by ID"""
    # This would fetch from database in production
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail="Analysis result retrieval not yet implemented",
    )


@router.get("/analysis/{analysis_id}/findings")
async def get_analysis_findings(
    analysis_id: UUID,
    severity: Optional[str] = None,
    finding_type: Optional[str] = Query(None, alias="type"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(PermissionChecker(["user"])),
):
    """Get findings for an analysis with filtering"""
    # Mock findings
    findings = mock_findings

    if severity:
        findings = [f for f in findings if f["severity"] == severity]
    if finding_type:
        findings = [f for f in findings if f["type"] == finding_type]

    total = len(findings)
    start = (page - 1) * page_size
    end = start + page_size

    return {
        "analysis_id": str(analysis_id),
        "findings": findings[start:end],
        "total": total,
        "page": page,
        "page_size": page_size,
    }


@router.get("/analyses")
async def get_my_analyses(db: AsyncSession = Depends(get_db), req: Request = None):
    # Check if user is logged in
    user_context = getattr(req.state, "user", None)
    if not user_context:
        raise HTTPException(status_code=401, detail="Log in to view analyses")
        
    user_id = user_context.get("id")
    from sqlalchemy import select
    result = await db.execute(
        select(AnalysisRecord)
        .where(AnalysisRecord.user_id == user_id)
        .order_by(AnalysisRecord.created_at.desc())
    )
    records = result.scalars().all()
    
    return [
        {
            "id": r.id,
            "repo_url": r.repo_url,
            "status": r.status,
            "health_score": r.health_score,
            "created_at": r.created_at
        }
        for r in records
    ]


@router.get("/analyses/{analysis_id}")
async def get_analysis_detail(
    analysis_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(PermissionChecker(["user"])),
):
    """Get full details of a saved analysis."""
    from sqlalchemy import select
    result = await db.execute(
        select(AnalysisRecord).where(
            AnalysisRecord.id == analysis_id,
            AnalysisRecord.user_id == current_user["id"],
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Analysis not found")

    return {
        "id": record.id,
        "repo_url": record.repo_url,
        "status": record.status,
        "health_score": record.health_score,
        "tech_debt_score": getattr(record, "tech_debt_score", 0),
        "maturity_level": getattr(record, "maturity_level", "Unknown"),
        "explanation": {"summary": record.summary, "eli5_summary": record.eli5_summary},
        "tech_stack": record.tech_stack,
        "important_files": record.important_files,
        "fixes": record.fixes,
        "dependencies": record.dependencies,
        "errors": record.errors,
        "run_steps": record.run_steps,
        "architecture": getattr(record, "architecture", {}),
        "security_report": getattr(record, "security_report", {}),
        "created_at": record.created_at.isoformat(),
        "completed_at": record.completed_at.isoformat() if record.completed_at else None,
    }

@router.post("/analyses/{analysis_id}/fixes/{fix_index}/pr")
async def create_fix_pr(
    analysis_id: str,
    fix_index: int,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(PermissionChecker(["user"])),
):
    """Trigger a GitHub PR for a specific fix."""
    from sqlalchemy import select
    result = await db.execute(
        select(AnalysisRecord).where(
            AnalysisRecord.id == analysis_id,
            AnalysisRecord.user_id == current_user["id"]
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Analysis not found")

    if not record.fixes or fix_index >= len(record.fixes):
        raise HTTPException(status_code=404, detail="Fix index out of range")

    fix = record.fixes[fix_index]
    github = get_github_client()
    
    try:
        pr_result = await github.create_pr(record.repo_url, fix)
        return {
            "status": "success",
            "pr_url": pr_result.get("html_url"),
            "pr_number": pr_result.get("number")
        }
    except Exception as e:
        logger.error("PR failed", error=str(e))
        raise HTTPException(status_code=500, detail=f"Failed to create PR: {str(e)}")


@router.post("/analysis/{analysis_id}/regenerate")
async def regenerate_analysis(
    analysis_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(PermissionChecker(["user"])),
):
    """Regenerate analysis with updated rules/models"""
    logger.info("Regenerating analysis", analysis_id=str(analysis_id))

    return {
        "analysis_id": str(analysis_id),
        "status": "queued",
        "message": "Analysis regeneration queued",
    }


@router.get("/rules")
async def list_analysis_rules(
    category: Optional[str] = None,
    language: Optional[str] = None,
    current_user: dict = Depends(PermissionChecker(["user"])),
):
    """List available analysis rules"""
    rules = [
        {
            "id": "sql-injection",
            "name": "SQL Injection Detection",
            "category": "security",
            "languages": ["python", "javascript", "java", "php"],
            "severity": "high",
            "description": "Detects potential SQL injection vulnerabilities",
        },
        {
            "id": "xss-detection",
            "name": "XSS Detection",
            "category": "security",
            "languages": ["javascript", "php", "python"],
            "severity": "high",
            "description": "Detects potential cross-site scripting vulnerabilities",
        },
        {
            "id": "inefficient-loop",
            "name": "Inefficient Loop Pattern",
            "category": "performance",
            "languages": ["python", "javascript"],
            "severity": "medium",
            "description": "Detects inefficient patterns in loops",
        },
        {
            "id": "complex-function",
            "name": "Overly Complex Function",
            "category": "quality",
            "languages": ["*"],
            "severity": "low",
            "description": "Detects functions with high cyclomatic complexity",
        },
    ]

    if category:
        rules = [r for r in rules if r["category"] == category]
    if language:
        rules = [r for r in rules if language in r["languages"] or "*" in r["languages"]]

    return {"rules": rules, "total": len(rules)}


@router.post("/search")
async def search_workspace(
    query: str = Query(..., min_length=1),
    current_user: dict = Depends(PermissionChecker(["user"])),
):
    """Semantic code search across the workspace."""
    import httpx
    from core.config import settings
    
    try:
        async with httpx.AsyncClient() as client:
            res = await client.post(
                f"{settings.KNOWLEDGE_SERVICE_URL}/api/v1/search",
                json={"query": query, "search_type": "hybrid", "limit": 10}
            )
            res.raise_for_status()
            return res.json()
    except Exception as e:
        logger.error("Search failed", error=str(e))
        raise HTTPException(status_code=500, detail="Search service currently unavailable")


@router.get("/analyses/{analysis_id}/forecast")
async def get_debt_forecast(
    analysis_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(PermissionChecker(["user"])),
):
    """Predict future technical debt growth."""
    from sqlalchemy import select
    result = await db.execute(
        select(AnalysisRecord).where(
            AnalysisRecord.id == analysis_id,
            AnalysisRecord.user_id == current_user["id"]
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Analysis not found")

    # Forecasting Algorithm:
    # Maintenance Interest = (Critical Vulns * 2) + (Total Files / 10)
    vuln_impact = len(record.security_report.get("dependencies", [])) * 2 if record.security_report else 0
    complexity_impact = len(record.important_files) * 0.5 if record.important_files else 0
    
    forecast = {
        "current_debt_hours": record.tech_debt_score * 4, # 4h per debt point
        "interest_rate_monthly": f"{min(15, vuln_impact + complexity_impact)}%",
        "predicted_debt_12m": record.tech_debt_score * 4 * 1.5,
        "critical_files_decay": [f["path"] for f in (record.important_files or [])[:3]]
    }
    
    return forecast
