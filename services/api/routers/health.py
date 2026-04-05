"""
Health check endpoints - improved to handle lite mode gracefully.
"""

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from core.database import get_db, redis_pool

router = APIRouter()


class HealthResponse(BaseModel):
    status: str
    version: str = "1.0.0"
    mode: str
    services: dict


class ReadinessResponse(BaseModel):
    ready: bool
    checks: dict


@router.get("/health", response_model=HealthResponse)
async def health_check():
    """Basic health check endpoint"""
    return HealthResponse(
        status="healthy",
        mode="lite" if settings.LITE_MODE else "full",
        services={"api": "up"},
    )


@router.get("/ready", response_model=ReadinessResponse)
async def readiness_check(db: AsyncSession = Depends(get_db)):
    """Readiness check - in lite mode, Redis is optional."""
    checks = {"database": False, "redis": None if settings.LITE_MODE else False}

    try:
        await db.execute(text("SELECT 1"))
        checks["database"] = True
    except Exception:
        pass

    if not settings.LITE_MODE:
        try:
            if redis_pool:
                await redis_pool.ping()
                checks["redis"] = True
        except Exception:
            checks["redis"] = False

    # In lite mode, only database matters for readiness
    required = {k: v for k, v in checks.items() if v is not None}
    all_ready = all(required.values())

    return ReadinessResponse(ready=all_ready, checks=checks)


@router.get("/live")
async def liveness_check():
    """Liveness check for Kubernetes"""
    return {"status": "alive"}


@router.get("/metrics")
async def metrics():
    """Prometheus metrics endpoint placeholder"""
    return {"metrics": "available", "note": "Full metrics available via prometheus-client in production"}
