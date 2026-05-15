"""
AtlasStack Lite Mode CLI

Run with `python app.py litemode` or install the package and use `app litemode`.
"""

import os
import sys
from pathlib import Path

import typer
from dotenv import load_dotenv

project_root = Path(__file__).parent.resolve()
services_api = project_root / "services" / "api"

# Ensure the project root and API module are importable
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(services_api))

load_dotenv(project_root / ".env")

app = typer.Typer(help="AtlasStack Lite Mode Startup")

@app.command()
def litemode(
    port: int = typer.Option(8000, "--port", "-p", help="Port to bind the Lite Mode backend"),
    reload: bool = typer.Option(False, "--reload", help="Enable auto-reload for development")
):
    """Start the AtlasStack backend in Lite Mode."""
    os.chdir(services_api)

    try:
        from main import app as fastapi_app
    except Exception as exc:
        typer.echo(f"CRITICAL: Failed to import AtlasStack API app: {exc}")
        raise typer.Exit(code=1)

    try:
        import uvicorn
    except ImportError as exc:
        typer.echo("CRITICAL: uvicorn is required to run Lite Mode. Install services/api requirements.")
        raise typer.Exit(code=1)

    typer.echo(f"Starting AtlasStack Lite Mode backend on http://0.0.0.0:{port}")
    uvicorn.run(fastapi_app, host="0.0.0.0", port=port, reload=reload)

if __name__ == "__main__":
    app()
