"""
Architecture graph endpoint for AtlasStack.
Drop this into services/api/main.py (or import it as a router).

Adds:
  GET  /api/v1/analysis/{analysis_id}/graph
  POST /api/v1/analysis/graph/preview   (quick parse — no DB needed)
"""

import os
import ast
import json
import tempfile
import subprocess
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from core.database import get_db, AnalysisRecord
from middleware.auth import PermissionChecker

router = APIRouter(prefix="/api/v1", tags=["graph"])

# ─── Pydantic models ───────────────────────────────────────────────────────────

class GraphNode(BaseModel):
    id: str
    label: str
    sub: str
    layer: str          # client | infra | core | data
    risk: bool
    risk_msg: Optional[str] = None
    info: str
    x: Optional[float] = None
    y: Optional[float] = None

class GraphEdge(BaseModel):
    from_: str          # "from" is a Python keyword — serialised as "from"
    to: str
    flow: bool          # True = live data path (animated), False = structural

    class Config:
        populate_by_name = True
        fields = {"from_": "from"}

class ArchGraph(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    repo: str
    score: int

# ─── Known service definitions (expand as AtlasStack grows) ──────────────────

KNOWN_SERVICES = {
    "services/api":      ("FastAPI",       "main gateway :8000",    "core"),
    "services/analysis": ("Celery worker", "analysis tasks",        "core"),
    "services/llm":      ("LLM service",   "Qwen2.5 :8001",         "core"),
    "services/knowledge":("Knowledge svc", "Neo4j+Weaviate :8002",  "core"),
    "clients/web":       ("React / Vite",  "web client",            "client"),
    "clients/vscode":    ("VS Code ext",   "IDE client",            "client"),
}

KNOWN_INFRA = [
    ("pg",       "PostgreSQL",  "users & history",    "data",  True,
     "POSTGRES_PASSWORD defaults to 'atlasstack_secret' in docker-compose.yml"),
    ("redis",    "Redis",       "cache & queue",      "data",  True,
     "REDIS_PASSWORD defaults to 'redis_secret' in docker-compose.yml"),
    ("neo4j",    "Neo4j",       "code graph :7687",   "data",  False, None),
    ("weaviate", "Weaviate",    "vectors :8080",       "data",  False, None),
    ("rabbit",   "RabbitMQ",    "message bus",         "data",  False, None),
    ("kong",     "Kong gateway","API gateway :8008",   "infra", False, None),
]

INFRA_EDGES = [
    ("web",       "kong",       False),
    ("vscode",    "kong",       False),
    ("kong",      "api",        True),
    ("api",       "worker",     True),
    ("api",       "pg",         False),
    ("api",       "redis",      False),
    ("worker",    "llm",        True),
    ("worker",    "knowledge",  True),
    ("worker",    "rabbit",     False),
    ("knowledge", "neo4j",      False),
    ("knowledge", "weaviate",   False),
    ("redis",     "rabbit",     False),
]

# ─── Risk detector ────────────────────────────────────────────────────────────

RISK_PATTERNS = {
    "JWT_SECRET":          ("api",   "JWT_SECRET is a placeholder value — anyone can forge tokens"),
    "atlasstack_secret":   ("pg",    "Default POSTGRES_PASSWORD in docker-compose.yml"),
    "redis_secret":        ("redis", "Default REDIS_PASSWORD in docker-compose.yml"),
    "CHANGE_ME":           ("api",   "Placeholder secret detected in config"),
}

def detect_file_risks(repo_path: Path) -> dict[str, str]:
    """Scan key config files and return {node_id: risk_message}."""
    risks: dict[str, str] = {}
    targets = [
        repo_path / ".env",
        repo_path / ".env.example",
        repo_path / "docker-compose.yml",
    ]
    for f in targets:
        if not f.exists():
            continue
        content = f.read_text(errors="ignore")
        for pattern, (node_id, msg) in RISK_PATTERNS.items():
            if pattern in content:
                risks[node_id] = msg
    return risks

# ─── AST import parser ────────────────────────────────────────────────────────

def parse_python_imports(file_path: Path) -> list[str]:
    """Return a list of top-level module names imported by a Python file."""
    try:
        tree = ast.parse(file_path.read_text(errors="ignore"))
        mods = []
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                mods += [alias.name.split(".")[0] for alias in node.names]
            elif isinstance(node, ast.ImportFrom) and node.module:
                mods.append(node.module.split(".")[0])
        return list(set(mods))
    except Exception:
        return []

# ─── Graph builder ────────────────────────────────────────────────────────────

SERVICE_INFO = {
    "api":       "Primary API gateway. Handles JWT auth, repo registration, analysis triggering, and history. Principal node: services/api/main.py",
    "worker":    "Async Celery worker. Clones repos, runs AST + security checks, feeds Neo4j and Weaviate.",
    "llm":       "Runs Qwen2.5-Coder-32B via HuggingFace. Generates explanations, ELI5 summaries, and patch suggestions.",
    "knowledge": "Stores code relationships in Neo4j (graph) and semantic embeddings in Weaviate (vector search).",
    "web":       "React + Vite frontend. The architecture map and dashboard live here.",
    "vscode":    "VS Code extension — brings AtlasStack analysis directly into the editor.",
    "pg":        "PostgreSQL: user accounts, repo metadata, analysis history. Passwords bcrypt-hashed.",
    "redis":     "Caching layer and Celery message broker.",
    "neo4j":     "Graph database. Stores function calls, imports, and module dependencies.",
    "weaviate":  "Vector search. Embeds code chunks for semantic queries.",
    "rabbit":    "RabbitMQ message bus connecting FastAPI to Celery workers.",
    "kong":      "Kong API gateway. Rate limiting, auth middleware, request routing.",
}

def build_graph(repo_path: Path, repo_url: str, score: int) -> ArchGraph:
    risks = detect_file_risks(repo_path)

    nodes: list[GraphNode] = []
    present_ids: set[str] = set()

    # Service nodes — only add ones whose directory exists in the repo
    for path_key, (label, sub, layer) in KNOWN_SERVICES.items():
        node_id = path_key.split("/")[-1]   # e.g. "api", "web"
        full_path = repo_path / path_key
        if not full_path.exists():
            continue
        present_ids.add(node_id)
        nodes.append(GraphNode(
            id=node_id, label=label, sub=sub, layer=layer,
            risk=node_id in risks,
            risk_msg=risks.get(node_id),
            info=SERVICE_INFO.get(node_id, f"{label} service"),
        ))

    # Infrastructure nodes — always include
    for (nid, label, sub, layer, _, _2) in KNOWN_INFRA:
        risk_msg = risks.get(nid)
        present_ids.add(nid)
        nodes.append(GraphNode(
            id=nid, label=label, sub=sub, layer=layer,
            risk=nid in risks,
            risk_msg=risk_msg,
            info=SERVICE_INFO.get(nid, f"{label}"),
        ))

    # Edges — only between nodes we actually included
    edges: list[GraphEdge] = []
    for (frm, to, flow) in INFRA_EDGES:
        if frm in present_ids and to in present_ids:
            edges.append(GraphEdge(**{"from": frm, "to": to, "flow": flow}))

    return ArchGraph(nodes=nodes, edges=edges, repo=repo_url, score=score)

# ─── Routes ───────────────────────────────────────────────────────────────────

@router.get("/analyses/{analysis_id}/graph", response_model=ArchGraph)
async def get_analysis_graph(
    analysis_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: dict = Depends(PermissionChecker(["user"])),
):
    """
    Return the architecture graph for a completed analysis.
    Clones the repo into a temp dir on the fly since we don't persist clone_path.
    """
    result = await db.execute(
        select(AnalysisRecord).where(
            AnalysisRecord.id == analysis_id,
            AnalysisRecord.user_id == current_user["id"]
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Analysis not found")

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        try:
            subprocess.run(
                ["git", "clone", "--depth", "1", record.repo_url, str(tmp_path / "repo")],
                capture_output=True, timeout=60, check=True,
            )
        except subprocess.CalledProcessError as e:
            raise HTTPException(status_code=422, detail=f"Could not clone repo: {e.stderr.decode()}")
        
        repo_path = tmp_path / "repo"
        return build_graph(repo_path=repo_path, repo_url=record.repo_url, score=record.health_score or 0)


class PreviewRequest(BaseModel):
    repo_url: str   # public GitHub URL

@router.post("/analysis/graph/preview", response_model=ArchGraph)
async def preview_graph(req: PreviewRequest):
    """
    Quick graph preview — clones the repo into a temp dir, builds graph, cleans up.
    Used for the public "paste a URL" demo flow (no auth required).
    Rate-limit this endpoint in Kong or via a Redis counter.
    """
    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        try:
            subprocess.run(
                ["git", "clone", "--depth", "1", req.repo_url, str(tmp_path / "repo")],
                capture_output=True, timeout=60, check=True,
            )
        except subprocess.CalledProcessError as e:
            raise HTTPException(status_code=422, detail=f"Could not clone repo: {e.stderr.decode()}")
        except subprocess.TimeoutExpired:
            raise HTTPException(status_code=408, detail="Clone timed out (60s)")

        repo_path = tmp_path / "repo"
        return build_graph(repo_path=repo_path, repo_url=req.repo_url, score=0)
