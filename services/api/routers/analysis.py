"""
Analysis endpoints
"""

from typing import List, Optional
from uuid import UUID

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field, HttpUrl, field_validator
from sqlalchemy.ext.asyncio import AsyncSession

from datetime import datetime, timedelta
from sqlalchemy import select, func
from core.database import get_db, AnalysisRecord, UserRecord
from utils.security import decrypt_token
from core.github_client import get_github_client
from middleware.auth import PermissionChecker
from utils.llm import call_llm_with_retry

logger = structlog.get_logger()
router = APIRouter()

from urllib.parse import urlparse
from concurrent.futures import ThreadPoolExecutor
import asyncio
import re
import os
from services.analysis.core.orchestrator import AnalysisOrchestrator

_executor = ThreadPoolExecutor(max_workers=4)

def validate_repo_url(url: str):
    """Validate repository URL to prevent SSRF, shell injection, and illegal paths."""
    logger.info(f"Validating repo URL", url=url)
    ALLOWED_DOMAINS = ["github.com", "gitlab.com", "bitbucket.org"]
    
    if not url:
        raise HTTPException(status_code=400, detail="Repository URL is required.")
        
    try:
        # 🛡️ SECURITY: Strict regex for allowed repo formats
        # Prevents flag injection (e.g. starting with -) and complex shell payloads
        repo_regex = r'^(https?:\/\/)?(www\.)?(github\.com|gitlab\.com|bitbucket\.org)\/[a-zA-Z0-9._-]+\/[a-zA-Z0-9._-]+(\.git)?\/?$'
        if not re.match(repo_regex, url):
            raise HTTPException(status_code=400, detail="Invalid repository URL format. Use standard GitHub/GitLab/Bitbucket links.")

        # SSRF Protection (redundant but good for defense-in-depth)
        if any(x in url.lower() for x in ["localhost", "127.0.0.1", "::1", "metadata.google.internal", "169.254.169.254"]):
            raise HTTPException(status_code=400, detail="Invalid repository URL (SSRF protected).")

        parsed = urlparse(url)
        hostname = (parsed.hostname or "").lower().replace('www.', '')
        
        if hostname not in ALLOWED_DOMAINS:
            raise HTTPException(status_code=400, detail=f"Only {', '.join(ALLOWED_DOMAINS)} are allowed.")

        return url
    except HTTPException:
        raise
    except Exception as e:
        logger.error("URL validation failed", error=str(e))
        raise HTTPException(status_code=400, detail="Invalid repository URL format.")


async def get_repo_size_mb(path: str) -> float:
    """Calculate directory size in MB."""
    total_size = 0
    for dirpath, dirnames, filenames in os.walk(path):
        for f in filenames:
            fp = os.path.join(dirpath, f)
            if not os.path.islink(fp):
                total_size += os.path.getsize(fp)
    return total_size / (1024 * 1024)


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
    repo_url: HttpUrl
    save_result: bool = True  # persist to DB

    @field_validator('repo_url', mode='after')
    @classmethod
    def validate_github(cls, v: HttpUrl) -> HttpUrl:
        if 'github.com' not in v.host and 'gitlab.com' not in v.host and 'bitbucket.org' not in v.host:
            raise ValueError('Must be a valid GitHub, GitLab, or Bitbucket URL')
        return v

class MVPAnalysisResponse(BaseModel):
    id: Optional[str] = None
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
    forecast: Optional[dict] = None


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
    """MVP Endpoint for full repository analysis - with DB persistence and security guards."""
    validate_repo_url(str(request.repo_url))
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
    is_pro = False
    if req:
        user_context = getattr(req.state, "user", None)
        if user_context:
            user_id = user_context.get("id", "anonymous")
            # For 100% correctness, we should fetch roles from DB, but we'll assume JWT is fresh
            roles = user_context.get("roles", [])
            is_pro = "pro" in roles

    # Enforce daily scan limit (Disabled for development)
    if False and not is_pro:
        pass # Placeholder for limit logic if re-enabled

    # Save initial record
    if request.save_result:
        record = AnalysisRecord(
            id=analysis_id,
            repo_id=analysis_id,
            user_id=user_id,
            repo_url=str(request.repo_url),
            status="running",
        )
        db.add(record)
        await db.commit()
    
    hf_token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")
    gemini_key = os.environ.get("GEMINI_API_KEY")
    
    # Check if any key exists
    if not hf_token and not gemini_key:
        logger.warning("No AI tokens found. Falling back to mock MVP response.")
        return MVPAnalysisResponse(
            id=analysis_id,
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
        
    github_token = None
    if user_id != "anonymous":
        user_result = await db.execute(select(UserRecord).where(UserRecord.id == user_id))
        user_rec = user_result.scalar_one_or_none()
        if user_rec and user_rec.github_token:
            github_token = decrypt_token(user_rec.github_token)

    try:
        orchestrator = AnalysisOrchestrator(hf_token=hf_token)
        result_json = await orchestrator.analyze_repository(str(request.repo_url), github_token=github_token)
        
        parsed = MVPAnalysisResponse(**result_json)
        parsed.id = analysis_id

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
async def get_my_analyses(
    db: AsyncSession = Depends(get_db), 
    req: Request = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100)
):
    # Return empty list if not authenticated (frontend handles gating via Clerk)
    user_context = getattr(req.state, "user", None) if req else None
    if not user_context:
        return {"analyses": [], "total": 0, "skip": skip, "limit": limit, "has_more": False}
        
    user_id = user_context.get("id")
    from sqlalchemy import select
    
    # Count total for frontend metadata
    count_stmt = select(func.count(AnalysisRecord.id)).where(AnalysisRecord.user_id == user_id)
    total_result = await db.execute(count_stmt)
    total_count = total_result.scalar() or 0
    
    result = await db.execute(
        select(AnalysisRecord)
        .where(AnalysisRecord.user_id == user_id)
        .order_by(AnalysisRecord.created_at.desc())
        .offset(skip)
        .limit(limit)
    )
    records = result.scalars().all()
    
    return {
        "analyses": [
            {
                "id": r.id,
                "repo_url": r.repo_url,
                "status": r.status,
                "health_score": r.health_score,
                "created_at": r.created_at
            }
            for r in records
        ],
        "total": total_count,
        "skip": skip,
        "limit": limit,
        "has_more": (skip + limit) < total_count
    }


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
        "explanation": {
            "summary": record.summary, 
            "eli5_summary": record.eli5_summary,
            "entry_point": getattr(record, "entry_point", "Unknown"),
            "architecture": getattr(record, "architecture", {}).get("summary", "System Architecture") if isinstance(getattr(record, "architecture", {}), dict) else "System Architecture",
            "data_flow": getattr(record, "data_flow", "Data Pipeline")
        },
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
    
    # Fetch user to get their github token
    user_result = await db.execute(select(UserRecord).where(UserRecord.id == current_user["id"]))
    user_rec = user_result.scalar_one_or_none()
    
    token = None
    if user_rec and user_rec.github_token:
        token = decrypt_token(user_rec.github_token)
        
    github = get_github_client(token=token)
    
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


class ApplyFixesRequest(BaseModel):
    overrides: Optional[dict] = None  # index -> new_code_add

@router.post("/analyses/{analysis_id}/fixes/apply_all")
async def apply_all_fixes_as_pr(
    analysis_id: str,
    request: ApplyFixesRequest = ApplyFixesRequest(),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(PermissionChecker(["user"])),
):
    """Apply all suggested fixes from an analysis into a single PR."""
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

    fixes = record.fixes or []
    if not fixes:
        raise HTTPException(status_code=400, detail="No fixes available for this analysis")

    # Fetch user to get their github token
    user_result = await db.execute(select(UserRecord).where(UserRecord.id == current_user["id"]))
    user_rec = user_result.scalar_one_or_none()

    token = None
    if user_rec and user_rec.github_token:
        token = decrypt_token(user_rec.github_token)

    github = get_github_client(token=token)

    # We'll clone, apply all fixes, commit once, push branch and open a PR
    import tempfile
    import shutil
    import os
    import httpx
    from git import Repo

    repo_url = record.repo_url
    parts = repo_url.rstrip("/").split("/")
    if len(parts) < 2:
        raise HTTPException(status_code=400, detail="Invalid repository URL")
    owner = parts[-2]
    repo_name = parts[-1]
    owner_repo = f"{owner}/{repo_name}"

    token_to_use = token or settings.GITHUB_TOKEN
    if not token_to_use:
        logger.error("No GitHub token found for PR creation. Fallback to settings.GITHUB_TOKEN failed.")
        raise HTTPException(
            status_code=403, 
            detail="No GitHub credentials available. Please connect your GitHub account or add GITHUB_TOKEN to your backend .env file."
        )

    temp_dir = tempfile.mkdtemp()
    try:
        authed_url = repo_url.replace("https://", f"https://x-access-token:{token_to_use}@")
        repo = Repo.clone_from(authed_url, temp_dir)

        branch_name = f"atlasstack/fixes-{os.urandom(4).hex()}"
        new_branch = repo.create_head(branch_name)
        new_branch.checkout()

        # Apply fixes
        for i, fix in enumerate(fixes):
            file_rel = fix.get("file_path")
            if not file_rel:
                continue
                
            code_add = fix.get("code_add", "")
            if request.overrides and str(i) in request.overrides:
                code_add = request.overrides[str(i)]
                
            file_path = os.path.join(temp_dir, file_rel)
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            if not os.path.exists(file_path):
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(code_add)
            else:
                with open(file_path, "r", encoding="utf-8") as f:
                    content = f.read()
                if fix.get("code_remove") and fix["code_remove"] in content:
                    new_content = content.replace(fix["code_remove"], code_add)
                else:
                    new_content = content + "\n\n# AtlasStack Suggested Fix\n" + code_add
                if new_content == content:
                    import time
                    new_content += f"\n# AtlasStack note: no-op patched at {int(time.time())}\n"
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(new_content)

        # Stage all changed files
        changed = [item.a_path for item in repo.index.diff(None)]
        # If no changed tracked files, add all fixes' file paths
        if not changed:
            changed = [f.get("file_path") for f in fixes if f.get("file_path")]

        repo.index.add(changed)

        from git import Actor
        author_obj = Actor("AtlasStack AI", "atlasstack-ai[bot]@users.noreply.github.com")
        repo.index.commit(f"AtlasStack: Apply suggested fixes for analysis {analysis_id}", author=author_obj, committer=author_obj)

        origin = repo.remote(name="origin")
        origin.push(branch_name)

        pr_data = {
            "title": f"AtlasStack: Automated fixes for analysis {analysis_id}",
            "body": f"This PR applies {len(fixes)} automated fixes suggested by AtlasStack AI for {record.repo_url}.",
            "head": branch_name,
            "base": record.branch or "main",
        }

        try:
            async with httpx.AsyncClient() as client:
                res = await client.post(
                    f"{github.api_base}/repos/{owner_repo}/pulls",
                    headers={**github._headers, "Authorization": f"token {token_to_use}"},
                    json=pr_data,
                )
                if res.status_code != 201:
                    logger.error("Failed to create combined PR", status=res.status_code, body=res.text)
                    raise HTTPException(
                        status_code=500, 
                        detail=f"PR creation failed on GitHub. Status: {res.status_code}. Error: {res.text}. "
                               "Ensure your GITHUB_TOKEN has 'repo' scope and write access to this repository."
                    )
                return res.json()
        except httpx.RequestError as exc:
            logger.error(f"Network error while creating PR: {exc}")
            raise HTTPException(status_code=500, detail=f"Failed to reach GitHub API: {str(exc)}")
    except Exception as e:
        logger.error(f"Critical error in PR flow: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Failed to create PR: {str(e)}")
    finally:
        # Robust cleanup
        if 'temp_dir' in locals() and os.path.exists(temp_dir):
            try:
                shutil.rmtree(temp_dir)
            except Exception as cleanup_err:
                logger.warning(f"Failed to cleanup temp dir {temp_dir}: {cleanup_err}")


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


@router.get("/languages")
async def list_supported_languages():
    """List supported programming languages for analysis."""
    return {
        "languages": [
            {"id": "python", "name": "Python", "extensions": [".py"]},
            {"id": "javascript", "name": "JavaScript", "extensions": [".js", ".jsx"]},
            {"id": "typescript", "name": "TypeScript", "extensions": [".ts", ".tsx"]},
            {"id": "go", "name": "Go", "extensions": [".go"]},
            {"id": "rust", "name": "Rust", "extensions": [".rs"]},
            {"id": "java", "name": "Java", "extensions": [".java"]},
            {"id": "cpp", "name": "C++", "extensions": [".cpp", ".h", ".hpp"]},
        ]
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
