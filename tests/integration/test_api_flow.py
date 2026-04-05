"""
Integration flow tests — register → login → create repo → analyze.
Uses TestClient (sync) for simplicity.
"""

import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "services" / "api"))


@pytest.fixture(scope="module")
def client():
    from main import app
    with TestClient(app, raise_server_exceptions=False) as c:
        yield c


def test_full_auth_and_repo_workflow(client):
    """Register → login → create repo → trigger analysis → delete."""

    email = "workflow@test.com"
    password = "securepass99"

    # Register
    reg = client.post("/api/v1/auth/register", json={"email": email, "password": password})
    assert reg.status_code == 201, reg.text
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Login
    login = client.post("/api/v1/auth/login", json={"email": email, "password": password})
    assert login.status_code == 200
    token = login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create repository
    resp = client.post(
        "/api/v1/repositories",
        headers=headers,
        json={"url": "https://github.com/example/repo", "branch": "main"},
    )
    assert resp.status_code == 201
    repo_id = resp.json()["id"]

    # List — should appear
    lst = client.get("/api/v1/repositories", headers=headers)
    assert lst.status_code == 200
    ids = [r["id"] for r in lst.json()["items"]]
    assert repo_id in ids

    # Trigger analysis
    analyze = client.post(
        f"/api/v1/repositories/{repo_id}/analyze",
        headers=headers,
        json={"analysis_types": ["security", "performance"]},
    )
    assert analyze.status_code == 200
    assert analyze.json()["status"] == "queued"

    # Delete
    delete = client.delete(f"/api/v1/repositories/{repo_id}", headers=headers)
    assert delete.status_code == 204


def test_cross_user_isolation(client):
    """User A cannot access User B's repositories."""

    def make_user(email):
        r = client.post(
            "/api/v1/auth/register", json={"email": email, "password": "password123"}
        )
        assert r.status_code == 201
        return {"Authorization": f"Bearer {r.json()['access_token']}"}

    headers_a = make_user("usera@test.com")
    headers_b = make_user("userb@test.com")

    # User A creates a repo
    repo = client.post(
        "/api/v1/repositories",
        headers=headers_a,
        json={"url": "https://github.com/a/secret-repo"},
    )
    assert repo.status_code == 201
    repo_id = repo.json()["id"]

    # User B cannot access it
    get = client.get(f"/api/v1/repositories/{repo_id}", headers=headers_b)
    assert get.status_code == 404

    # User B cannot delete it either
    delete = client.delete(f"/api/v1/repositories/{repo_id}", headers=headers_b)
    assert delete.status_code == 404
