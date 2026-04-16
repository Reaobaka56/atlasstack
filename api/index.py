import sys
import os
from pathlib import Path

# Add services/api to sys.path so it can find 'main' and 'routers' etc.
current_dir = Path(__file__).parent
project_root = current_dir.parent
services_api = project_root / "services" / "api"

sys.path.insert(0, str(project_root))
sys.path.insert(0, str(services_api))

# Import the FastAPI app
from main import app as api_app

# Vercel needs 'app' to be the entry point
app = api_app
