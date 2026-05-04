"""Pytest configuration — adds all service roots to sys.path."""

import asyncio
import sys
import pytest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Add all service directories to path so imports work without installation
for svc in ["services/api", "services/analysis", "services/llm", "services/knowledge", "shared"]:
    p = str(ROOT / svc)
    if p not in sys.path:
        sys.path.insert(0, p)


# Fix pytest-asyncio event loop policy for Python 3.12+
def pytest_configure(config):
    import pytest
    # Use session-scoped event loop for all async tests
    asyncio.set_event_loop_policy(asyncio.DefaultEventLoopPolicy())


@pytest.fixture
def test_client():
    """Get a FastAPI test client"""
    from fastapi.testclient import TestClient
    from services.api.main import app
    return TestClient(app)


@pytest.fixture
async def async_db_session():
    """Get a mock async DB session"""
    from unittest.mock import AsyncMock
    return AsyncMock()
