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
from shared.utils.terminal import print_header, render_analysis_report, create_progress, console, render_history_table
from core.database import init_db, AnalysisRecord, get_db_session
from sqlalchemy import select
from datetime import datetime

app = typer.Typer(help="AtlasStack: Autonomous Software Engineering Engine")

@app.command()
def analyze(repo_url: str = typer.Argument(..., help="GitHub repository URL")):
    """Analyze a remote GitHub repository."""
    print_header()
    
    async def run():
        await init_db()
        orchestrator = AnalysisOrchestrator()
        
        with create_progress() as progress:
            task = progress.add_task("[silver]Analyzing repository...[/silver]", total=100)
            
            # Since our orchestrator is one big async call, we'll just simulate progress
            # or we could break it down. For now, we'll just run it.
            try:
                result = await orchestrator.analyze_repository(repo_url)
                progress.update(task, completed=100)
            except Exception as e:
                console.print(f"[danger]Analysis Failed:[/danger] {str(e)}")
                return

        render_analysis_report(result)
        
        # Save to DB
        scan_id = str(uuid.uuid4())
        await save_analysis_to_db(scan_id, repo_url, result)
        
        console.print(f"\n[muted]Analysis complete. ID: {scan_id}[/muted]")

    asyncio.run(run())

@app.command()
def scan(path: str = typer.Argument(".", help="Local directory path to scan")):
    """Scan and analyze a local project directory."""
    print_header()
    
    abs_path = os.path.abspath(path)
    if not os.path.isdir(abs_path):
        console.print(f"[danger]Error:[/danger] {path} is not a valid directory.")
        raise typer.Exit(1)

    async def run():
        await init_db()
        orchestrator = AnalysisOrchestrator()
        
        with create_progress() as progress:
            progress.add_task(f"[silver]Scanning local path: {path}...[/silver]", total=None)
            result = await orchestrator.analyze_repository(abs_path, is_local=True)
            
        render_analysis_report(result)
        
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
            
            render_analysis_report(data)
            console.print(f"\n[muted]Viewing Scan ID: {record.id} | Analyzed on: {record.created_at}[/muted]")

    asyncio.run(run())

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
        # Session commit is handled by get_db_session context manager

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
    app()
