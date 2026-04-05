"""
Repository management endpoints - improved with database persistence.
"""

import uuid
from datetime import datetime
from typing import List, Optional

import structlog
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field, HttpUrl
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db, RepositoryRecord
from middleware.auth import PermissionChecker

logger = structlog.get_logger()
router = APIRouter()


class RepositoryCreate(BaseModel):
    url: HttpUrl
    branch: str = "main"
    name: Optional[str] = None
    description: Optional[str] = None
    is_private: bool = False


class RepositoryResponse(BaseModel):
    id: str
    url: str
    name: str
    branch: str
    description: Optional[str]
    status: str
    last_analyzed_at: Optional[str]
    created_at: str


class RepositoryList(BaseModel):
    items: List[RepositoryResponse]
    total: int
    page: int
    page_size: int


class AnalysisRequest(BaseModel):
    analysis_types: List[str] = Field(
        default_factory=lambda: ["security", "performance", "quality"]
    )
    options: Optional[dict] = None


def _repo_to_response(repo: RepositoryRecord) -> RepositoryResponse:
    return RepositoryResponse(
        id=str(repo.id),
        url=repo.url,
        name=repo.name,
        branch=repo.branch,
        description=repo.description,
        status=repo.status,
        last_analyzed_at=repo.last_analyzed_at.isoformat() if repo.last_analyzed_at else None,
        created_at=repo.created_at.isoformat(),
    )


@router.post("/repositories", response_model=RepositoryResponse, status_code=status.HTTP_201_CREATED)
async def create_repository(
    repo: RepositoryCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(PermissionChecker(["user"])),
):
    """Register a new repository for analysis, persisted to DB."""
    repo_id = str(uuid.uuid4())
    url_str = str(repo.url)
    name = repo.name or url_str.rstrip("/").split("/")[-1].replace(".git", "")

    record = RepositoryRecord(
        id=repo_id,
        user_id=current_user["id"],
        url=url_str,
        name=name,
        branch=repo.branch,
        description=repo.description,
        status="pending",
    )
    db.add(record)
    await db.commit()
    await db.refresh(record)

    logger.info("Repository registered", repo_id=repo_id, url=url_str, user=current_user["id"])
    return _repo_to_response(record)


@router.get("/repositories", response_model=RepositoryList)
async def list_repositories(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    repo_status: Optional[str] = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(PermissionChecker(["user"])),
):
    """List repositories for the authenticated user."""
    query = select(RepositoryRecord).where(RepositoryRecord.user_id == current_user["id"])
    if repo_status:
        query = query.where(RepositoryRecord.status == repo_status)

    result = await db.execute(query)
    all_repos = result.scalars().all()
    total = len(all_repos)

    start = (page - 1) * page_size
    paginated = all_repos[start : start + page_size]

    return RepositoryList(
        items=[_repo_to_response(r) for r in paginated],
        total=total, page=page, page_size=page_size,
    )


@router.get("/repositories/{repo_id}", response_model=RepositoryResponse)
async def get_repository(
    repo_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(PermissionChecker(["user"])),
):
    result = await db.execute(
        select(RepositoryRecord).where(
            RepositoryRecord.id == repo_id,
            RepositoryRecord.user_id == current_user["id"],
        )
    )
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")
    return _repo_to_response(repo)


@router.post("/repositories/{repo_id}/analyze")
async def analyze_repository(
    repo_id: str,
    request: AnalysisRequest,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(PermissionChecker(["user"])),
):
    """Submit a repository for analysis."""
    result = await db.execute(
        select(RepositoryRecord).where(
            RepositoryRecord.id == repo_id,
            RepositoryRecord.user_id == current_user["id"],
        )
    )
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    repo.status = "analyzing"
    await db.commit()

    logger.info("Analysis requested", repo_id=repo_id, types=request.analysis_types)
    return {
        "message": "Analysis started",
        "repo_id": repo_id,
        "analysis_types": request.analysis_types,
        "status": "queued",
    }


@router.delete("/repositories/{repo_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_repository(
    repo_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(PermissionChecker(["user"])),
):
    result = await db.execute(
        select(RepositoryRecord).where(
            RepositoryRecord.id == repo_id,
            RepositoryRecord.user_id == current_user["id"],
        )
    )
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    await db.delete(repo)
    await db.commit()
    logger.info("Repository deleted", repo_id=repo_id)
    return None


@router.get("/repositories/{repo_id}/status")
async def get_analysis_status(
    repo_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(PermissionChecker(["user"])),
):
    result = await db.execute(
        select(RepositoryRecord).where(
            RepositoryRecord.id == repo_id,
            RepositoryRecord.user_id == current_user["id"],
        )
    )
    repo = result.scalar_one_or_none()
    if not repo:
        raise HTTPException(status_code=404, detail="Repository not found")

    return {
        "repo_id": repo_id,
        "status": repo.status,
        "last_analyzed_at": repo.last_analyzed_at.isoformat() if repo.last_analyzed_at else None,
    }
