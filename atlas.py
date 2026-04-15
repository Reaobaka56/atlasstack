"""
AtlasStack CLI
Premium Terminal Tool for Autonomous Software Engineering.
"""

import os
import sys
import asyncio
import typer
from pathlib import Path
from typing import Optional

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
from shared.utils.terminal import print_header, render_analysis_report, create_progress, console
from core.database import init_db, AnalysisRecord, get_db_session

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
        console.print(f"\n[muted]Analysis complete. ID: {uuid_from_result_if_any}[/muted]")

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
    
    asyncio.run(run())

@app.command()
def history(limit: int = typer.Option(10, help="Number of recent scans to show")):
    """Show history of past scans."""
    print_header()
    
    async def run():
        await init_db()
        # This is a bit complex due to async session, but we can use the context manager
        # For simplicity in this demo, we'll just print a placeholder if DB logic is too tied to FastAPI
        console.print("[info]Fetching scan history...[/info]")
        # TODO: Implement DB fetch for CLI
        console.print("[muted]History feature coming soon in v1.1[/muted]")

    asyncio.run(run())

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
    import re # Needed for config
    app()
