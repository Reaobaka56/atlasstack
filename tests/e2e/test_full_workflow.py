import pytest
import sys
from pathlib import Path
from httpx import AsyncClient, ASGITransport

# Add services/api to sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "services" / "api"))
from main import app

@pytest.mark.asyncio
class TestFullWorkflow:
    """Test complete analysis workflow using internal ASGI transport."""
    
    async def test_health_check(self):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            response = await client.get("/health")
            assert response.status_code == 200
            assert response.json()["status"] == "healthy"
    
    async def test_repository_registration_and_analysis(self):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # Check metadata endpoints
            response = await client.get("/api/v1/languages")
            assert response.status_code == 200
            
            # Check rules
            response = await client.get("/api/v1/rules")
            assert response.status_code == 200
    
    async def test_code_analysis(self):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            payload = {
                "snippet": {
                    "code": 'cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")',
                    "language": "python"
                },
                "analysis_types": ["security"]
            }
            
            response = await client.post("/api/v1/analyze", json=payload)
            assert response.status_code == 200
            
            data = response.json()
            assert "findings" in data
            # Should find SQL injection
            sql_findings = [f for f in data["findings"] if "SQL" in f.get("message", "")]
            assert len(sql_findings) > 0
