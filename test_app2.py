"""
AtlasStack Lite Mode entry point.
Runs the FastAPI backend locally without Docker.

Usage:
    python test_app2.py

The server starts on http://0.0.0.0:8005
API docs available at http://localhost:8005/docs
"""

import os
import sys
from pathlib import Path

# Add project root and services/api to path regardless of OS
project_root = Path(__file__).parent
services_api = project_root / "services" / "api"

sys.path.insert(0, str(project_root))
sys.path.insert(0, str(services_api))

# Load .env from project root before changing directory
try:
    from dotenv import load_dotenv
    load_dotenv(project_root / ".env")
except ImportError:
    pass

# Change working directory to services/api so relative DB path works
os.chdir(services_api)

from fastapi import Request
from main import app


@app.middleware("http")
async def catch_exceptions_middleware(request: Request, call_next):
    try:
        return await call_next(request)
    except Exception as e:
        import traceback
        traceback.print_exc()
        from fastapi.responses import JSONResponse
        return JSONResponse(
            content={"detail": "Internal server error", "error": str(e)},
            status_code=500,
        )


if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.environ.get("PORT", 8005))
    print(f"Starting AtlasStack on port {port}...")
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=False
    )
