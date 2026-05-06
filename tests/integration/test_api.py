"""
Integration tests for the API Gateway.
Uses HTTPX AsyncClient with the app's full lifespan (creates DB tables).
"""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "services" / "api"))

import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport

# Use a fresh in-memory SQLite DB per test session
import core.config as _cfg
_cfg.settings.LITE_MODE = False
_cfg.settings.DEBUG = False

import core.database as _db
_db.engine = None  # will be recreated


@pytest_asyncio.fixture(scope="module")
async def client():
    """Start the app with its full lifespan so DB tables get created."""
    # Point to a temp in-memory-style DB for tests
    import core.database as db_mod
    from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
    from sqlalchemy.orm import sessionmaker
    from core.database import Base

    test_engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    TestSession = sessionmaker(test_engine, class_=AsyncSession,
                               expire_on_commit=False, autocommit=False, autoflush=False)

    # Monkeypatch the module-level engine and session factory
    db_mod.engine = test_engine
    db_mod.AsyncSessionLocal = TestSession
    
    # Mock Redis to prevent connection errors
    from unittest.mock import AsyncMock
    mock_redis = AsyncMock()
    mock_redis.ping.return_value = True
    db_mod.redis_pool = mock_redis

    from main import app

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c

    await test_engine.dispose()


@pytest.fixture
def auth_headers():
    from middleware.auth import create_access_token
    token = create_access_token("test-user-id", "test@example.com", roles=["user"])
    return {"Authorization": f"Bearer {token}"}


async def test_health_endpoint(client):
    r = await client.get("/health")
    assert r.status_code == 200
    assert r.json()["status"] == "healthy"
    assert "mode" in r.json()


async def test_root_endpoint(client):
    r = await client.get("/")
    assert r.status_code == 200
    data = r.json()
    assert "name" in data
    assert "endpoints" in data


async def test_liveness_endpoint(client):
    r = await client.get("/live")
    assert r.status_code == 200


async def test_login_wrong_credentials(client):
    r = await client.post("/api/v1/auth/login",
                          json={"email": "nobody@x.com", "password": "wrong"})
    assert r.status_code == 401


async def test_register_and_login_flow(client):
    # Register
    reg = await client.post("/api/v1/auth/register",
                             json={"email": "flow@test.com", "password": "testpassword123"})
    assert reg.status_code == 201, reg.text
    assert "access_token" in reg.json()
    assert "user_id" in reg.json()

    # Login
    login = await client.post("/api/v1/auth/login",
                               json={"email": "flow@test.com", "password": "testpassword123"})
    assert login.status_code == 200

    # Duplicate registration → 409
    dup = await client.post("/api/v1/auth/register",
                             json={"email": "flow@test.com", "password": "testpassword123"})
    assert dup.status_code == 409


async def test_short_password_rejected(client):
    r = await client.post("/api/v1/auth/register",
                           json={"email": "short@test.com", "password": "abc"})
    assert r.status_code == 422


async def test_protected_without_token(client):
    r = await client.get("/api/v1/repositories")
    assert r.status_code == 401


async def test_protected_with_token(client, auth_headers):
    r = await client.get("/api/v1/repositories", headers=auth_headers)
    assert r.status_code == 200
    data = r.json()
    assert "items" in data and "total" in data


async def test_repository_full_crud(client, auth_headers):
    # Create
    create = await client.post("/api/v1/repositories",
                                headers=auth_headers,
                                json={"url": "https://github.com/example/myrepo"})
    assert create.status_code == 201
    repo = create.json()
    repo_id = repo["id"]
    assert repo["name"] == "myrepo"
    assert repo["status"] == "pending"

    # Retrieve
    get = await client.get(f"/api/v1/repositories/{repo_id}", headers=auth_headers)
    assert get.status_code == 200

    # List — appears in list
    lst = await client.get("/api/v1/repositories", headers=auth_headers)
    ids = [r["id"] for r in lst.json()["items"]]
    assert repo_id in ids

    # Trigger analysis
    analyze = await client.post(f"/api/v1/repositories/{repo_id}/analyze",
                                 headers=auth_headers,
                                 json={"analysis_types": ["security"]})
    assert analyze.status_code == 200
    assert analyze.json()["status"] == "queued"

    # Status
    status = await client.get(f"/api/v1/repositories/{repo_id}/status", headers=auth_headers)
    assert status.status_code == 200
    assert status.json()["status"] == "analyzing"

    # Delete
    delete = await client.delete(f"/api/v1/repositories/{repo_id}", headers=auth_headers)
    assert delete.status_code == 204

    # Gone
    gone = await client.get(f"/api/v1/repositories/{repo_id}", headers=auth_headers)
    assert gone.status_code == 404


async def test_analyses_list(client, auth_headers):
    r = await client.get("/api/v1/analyses", headers=auth_headers)
    assert r.status_code == 200
    assert "analyses" in r.json()


async def test_analysis_not_found(client, auth_headers):
    r = await client.get("/api/v1/analyses/nonexistent-id", headers=auth_headers)
    assert r.status_code == 404


async def test_rules_endpoint(client, auth_headers):
    r = await client.get("/api/v1/rules", headers=auth_headers)
    assert r.status_code == 200
    assert len(r.json()["rules"]) > 0


async def test_languages_endpoint(client, auth_headers):
    r = await client.get("/api/v1/languages", headers=auth_headers)
    assert r.status_code == 200
    langs = [l["id"] for l in r.json()["languages"]]
    assert "python" in langs
    assert "javascript" in langs


async def test_cross_user_isolation(client):
    """User A's repos are invisible to User B."""
    async def register_and_get_headers(email):
        r = await client.post("/api/v1/auth/register",
                               json={"email": email, "password": "password999"})
        assert r.status_code == 201, r.text
        return {"Authorization": f"Bearer {r.json()['access_token']}"}

    headers_a = await register_and_get_headers("iso_a@test.com")
    headers_b = await register_and_get_headers("iso_b@test.com")

    # A creates a repo
    repo = await client.post("/api/v1/repositories", headers=headers_a,
                              json={"url": "https://github.com/a/secret"})
    assert repo.status_code == 201
    repo_id = repo.json()["id"]

    # B cannot see or delete it
    assert (await client.get(f"/api/v1/repositories/{repo_id}", headers=headers_b)).status_code == 404
    assert (await client.delete(f"/api/v1/repositories/{repo_id}", headers=headers_b)).status_code == 404
