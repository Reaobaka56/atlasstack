from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from core.database import get_db
import os
import shutil
from huggingface_hub import InferenceClient

router = APIRouter()

@router.get("/health")
async def health_check():
    """Basic health check for container liveness."""
    return {"status": "ok"}

@router.get("/health/deep")
async def deep_health_check(db: AsyncSession = Depends(get_db)):
    """Comprehensive health check for all system dependencies."""
    checks = {}
    
    # 1. Database Check
    try:
        await db.execute(text("SELECT 1"))
        checks["database"] = "ok"
    except Exception as e:
        checks["database"] = f"failed: {str(e)}"
        
    # 2. LLM Service Check
    try:
        hf_token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")
        if not hf_token:
            checks["llm_api"] = "warning: HF_TOKEN missing"
        else:
            client = InferenceClient(api_key=hf_token)
            # Just check if we can reach the model info
            client.get_model_info("Qwen/Qwen2.5-Coder-32B-Instruct")
            checks["llm_api"] = "ok"
    except Exception as e:
        checks["llm_api"] = f"failed: {str(e)}"
        
    # 3. Disk Space Check
    try:
        usage = shutil.disk_usage("/")
        free_gb = usage.free / (1024 ** 3)
        if free_gb < 1.0:
            checks["disk"] = f"critical: {free_gb:.2f}GB free"
        else:
            checks["disk"] = f"ok ({free_gb:.2f}GB free)"
    except Exception as e:
        checks["disk"] = f"failed: {str(e)}"
        
    status = "ok"
    if any(v.startswith("failed") or v.startswith("critical") for v in checks.values()):
        status = "unhealthy"
    elif any(v.startswith("warning") for v in checks.values()):
        status = "degraded"
        
    return {
        "status": status,
        "checks": checks
    }
