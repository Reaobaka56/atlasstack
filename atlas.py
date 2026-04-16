"""
AtlasStack CLI
Premium Terminal Tool for Autonomous Software Engineering.
"""

import os
import sys
import asyncio
import typer
import re
import uuid
import httpx
import json
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

# Force UTF-8 encoding for Windows terminals
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

# Setup path for internal imports
project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))
# We need services/api for certain core modules if they aren't fully decoupled
sys.path.insert(0, str(project_root / "services" / "api"))

from services.analysis.core.orchestrator import AnalysisOrchestrator
from services.analysis.engine.docker_engine import DockerAnalysisEngine
from shared.utils.terminal import (
    print_header, render_analysis_report, create_progress, 
    console, render_history_table, render_architecture_graph
)
from shared.utils.auth import save_token, load_token, clear_token, get_auth_header
from core.database import init_db, AnalysisRecord, get_db_session
from sqlalchemy import select
from datetime import datetime

app = typer.Typer(help="AtlasStack: Autonomous Software Engineering Engine")

# Global options state
state = {"eli5": False}

@app.callback()
def main(eli5: bool = typer.Option(False, "--eli5", "-e", help="Show ELI5 simple explanation")):
    """AtlasStack: Autonomous Software Engineering Engine"""
    if eli5:
        state["eli5"] = True

@app.command()
def analyze(
    repo_url: str = typer.Argument(..., help="GitHub repository URL"),
    docker: bool = typer.Option(False, "--docker", help="Run analysis in isolated Docker container")
):
    """Analyze a remote GitHub repository."""
    print_header()
    
    async def run():
        await init_db()
        
        try:
            if docker:
                engine = DockerAnalysisEngine()
                with create_progress() as progress:
                    progress.add_task("[silver]Starting isolated Docker analysis...[/silver]", total=None)
                    result = engine.run_isolated_scan(repo_url, is_local=False)
            else:
                orchestrator = AnalysisOrchestrator()
                with create_progress() as progress:
                    task = progress.add_task("[silver]Analyzing repository...[/silver]", total=100)
                    result = await orchestrator.analyze_repository(repo_url)
                    progress.update(task, completed=100)
        except Exception as e:
            console.print(f"[danger]Analysis Failed:[/danger] {str(e)}")
            return

        render_analysis_report(result, eli5_only=state["eli5"])
        
        # Save to DB
        scan_id = str(uuid.uuid4())
        await save_analysis_to_db(scan_id, repo_url, result)
        
        console.print(f"\n[muted]Analysis complete. ID: {scan_id}[/muted]")

    asyncio.run(run())

@app.command()
def scan(
    path: str = typer.Argument(".", help="Local directory path to scan"),
    docker: bool = typer.Option(False, "--docker", help="Run analysis in isolated Docker container")
):
    """Scan and analyze a local project directory."""
    print_header()
    
    abs_path = os.path.abspath(path)
    if not os.path.isdir(abs_path):
        console.print(f"[danger]Error:[/danger] {path} is not a valid directory.")
        raise typer.Exit(1)

    async def run():
        await init_db()
        
        try:
            if docker:
                engine = DockerAnalysisEngine()
                with create_progress() as progress:
                    progress.add_task(f"[silver]Starting isolated Docker scan: {path}...[/silver]", total=None)
                    result = engine.run_isolated_scan(abs_path, is_local=True)
            else:
                orchestrator = AnalysisOrchestrator()
                with create_progress() as progress:
                    progress.add_task(f"[silver]Scanning local path: {path}...[/silver]", total=None)
                    result = await orchestrator.analyze_repository(abs_path, is_local=True)
        except Exception as e:
            console.print(f"[danger]Scan Failed:[/danger] {str(e)}")
            return
            
        render_analysis_report(result, eli5_only=state["eli5"])
        
        # Save to DB
        scan_id = str(uuid.uuid4())
        await save_analysis_to_db(scan_id, abs_path, result)
        
        console.print(f"\n[muted]Scan complete. ID: {scan_id}[/muted]")
    
    asyncio.run(run())

@app.command()
def history(limit: int = typer.Option(10, help="Number of recent scans to show")):
    """Show history of past scans."""
    print_header()
    
    async def run():
        await init_db()
        async with get_db_session() as session:
            stmt = select(AnalysisRecord).order_by(AnalysisRecord.created_at.desc()).limit(limit)
            result = await session.execute(stmt)
            records = result.scalars().all()
            
            if not records:
                console.print("[yellow]No analysis history found.[/yellow]")
                return
                
            render_history_table(records)

    asyncio.run(run())

@app.command()
def view(analysis_id: str = typer.Argument(..., help="ID of the analysis to view")):
    """View details of a past analysis."""
    print_header()
    
    async def run():
        await init_db()
        async with get_db_session() as session:
            stmt = select(AnalysisRecord).where(
                (AnalysisRecord.id == analysis_id) | 
                (AnalysisRecord.id.like(f"{analysis_id}%"))
            )
            result = await session.execute(stmt)
            record = result.scalars().first()
            
            if not record:
                console.print(f"[danger]Error:[/danger] Analysis with ID [bold]{analysis_id}[/bold] not found.")
                return

            # Reconstruct result dict from record for the renderer
            data = {
                "explanation": {
                    "summary": record.summary,
                    "eli5_summary": record.eli5_summary
                },
                "health_score": record.health_score,
                "tech_debt_score": record.tech_debt_score,
                "maturity_level": record.maturity_level,
                "tech_stack": record.tech_stack or {},
                "security_report": record.security_report or {},
                "fixes": record.fixes or [],
                "run_steps": record.run_steps or [],
                "dependencies": record.dependencies or []
            }
            
            render_analysis_report(data, eli5_only=state["eli5"])
            console.print(f"\n[muted]Viewing Scan ID: {record.id} | Analyzed on: {record.created_at}[/muted]")

    asyncio.run(run())

@app.command()
def graph(analysis_id: str = typer.Argument(..., help="ID of the analysis to view architecture map")):
    """View architecture map of a past analysis."""
    print_header()
    
    async def run():
        await init_db()
        async with get_db_session() as session:
            stmt = select(AnalysisRecord).where(
                (AnalysisRecord.id == analysis_id) | 
                (AnalysisRecord.id.like(f"{analysis_id}%"))
            )
            result = await session.execute(stmt)
            record = result.scalars().first()
            
            if not record:
                console.print(f"[danger]Error:[/danger] Analysis with ID [bold]{analysis_id}[/bold] not found.")
                return

            if not record.architecture:
                console.print("[yellow]No architecture data found for this scan.[/yellow]")
                return
                
            render_architecture_graph(record.architecture)

    asyncio.run(run())

@app.command()
def login(
    email: str = typer.Option(None, prompt=True),
    password: str = typer.Option(None, prompt=True, hide_input=True)
):
    """Login to AtlasStack Cloud."""
    console.print(f"[silver]Authenticating [premium]{email}[/premium]...[/silver]")
    
    # Check for API URL in env or default to localhost
    base_url = os.getenv("API_URL", "http://localhost:8000")
    
    try:
        resp = httpx.post(
            f"{base_url}/auth/login",
            json={"email": email, "password": password},
            timeout=10.0
        )
        if resp.status_code == 200:
            data = resp.json()
            save_token(data["access_token"], email)
            console.print("[success]Successfully logged in![/success]")
        else:
            console.print(f"[danger]Login failed:[/danger] {resp.json().get('detail', 'Unknown error')}")
    except Exception as e:
        console.print(f"[danger]Error connecting to server:[/danger] {str(e)}")

@app.command()
def logout():
    """Clear local credentials."""
    clear_token()
    console.print("[success]Logged out successfully.[/success]")

@app.command()
def optimize():
    """Trigger the model fine-tuning flywheel using collected telemetry."""
    print_header()
    console.print("[premium]Starting Autonomous Optimization Pipeline...[/premium]")
    
    # Path to training datasets
    dataset_path = project_root / "training" / "datasets" / "collected_scans.jsonl"
    
    if not dataset_path.exists() or dataset_path.stat().st_size == 0:
        console.print("[yellow]No telemetry data found. Run more scans to collect training data.[/yellow]")
        return
        
    try:
        # Run the training pipeline as a subprocess
        cmd = [
            sys.executable,
            str(project_root / "training" / "pipeline.py"),
            "--mode", "sft",
            "--config", str(project_root / "training" / "configs" / "default_sft.yaml")
        ]
        
        with create_progress() as progress:
            progress.add_task("[silver]Fine-tuning model on collected scans...[/silver]", total=None)
            subprocess.run(cmd, check=True)
            
        console.print("[success]Optimization complete! Model has been updated with new telemetry.[/success]")
    except Exception as e:
        console.print(f"[danger]Optimization failed:[/danger] {str(e)}")

async def save_analysis_to_db(scan_id: str, url: str, result: dict):
    """Saves a scan result to the shared SQLite database."""
    async with get_db_session() as session:
        explanation = result.get("explanation", {})
        record = AnalysisRecord(
            id=scan_id,
            repo_id="cli-repo", # Placeholder for CLI scans
            user_id="cli-user", # Default CLI user
            repo_url=url,
            status="completed",
            health_score=result.get("health_score", 0),
            tech_debt_score=result.get("tech_debt_score", 0),
            maturity_level=result.get("maturity_level", "Unknown"),
            summary=explanation.get("summary", ""),
            eli5_summary=explanation.get("eli5_summary", ""),
            tech_stack=result.get("tech_stack", {}),
            important_files=result.get("important_files", []),
            fixes=result.get("fixes", []),
            dependencies=result.get("dependencies", []),
            errors=result.get("errors", []),
            run_steps=result.get("run_steps", []),
            architecture=result.get("architecture", {}),
            security_report=result.get("security_report", {}),
            completed_at=datetime.utcnow()
        )
        session.add(record)

@app.command()
def config(hf_token: str = typer.Option(None, prompt=True, hide_input=True)):
    """Configure AtlasStack credentials."""
    env_path = project_root / ".env"
    
    content = ""
    if env_path.exists():
        content = env_path.read_text()
    
    if "HF_TOKEN=" in content:
        content = re.sub(r'HF_TOKEN=.*', f'HF_TOKEN={hf_token}', content)
    else:
        content += f"\nHF_TOKEN={hf_token}\n"
    
    env_path.write_text(content)
    console.print("[success]Configuration updated successfully![/success]")

if __name__ == "__main__":
    # Ensure subprocess is imported if optimize is called
    import subprocess
    app()
