import os
import json
from pathlib import Path
from typing import Optional

# Configuration directory
CONFIG_DIR = Path.home() / ".atlas"
CREDENTIALS_FILE = CONFIG_DIR / "credentials.json"

def save_token(token: str, email: str):
    """Saves the JWT token and user info to the local config directory."""
    CONFIG_DIR.mkdir(parents=True, exist_ok=True)
    data = {
        "access_token": token,
        "email": email
    }
    with open(CREDENTIALS_FILE, "w") as f:
        json.dump(data, f, indent=4)

def load_token() -> Optional[str]:
    """Loads the JWT token from the local config directory."""
    if not CREDENTIALS_FILE.exists():
        return None
    try:
        with open(CREDENTIALS_FILE, "r") as f:
            data = json.load(f)
            return data.get("access_token")
    except Exception:
        return None

def clear_token():
    """Removes the stored credentials."""
    if CREDENTIALS_FILE.exists():
        CREDENTIALS_FILE.unlink()

def get_auth_header() -> dict:
    """Returns the Authorization header if a token exists."""
    token = load_token()
    if token:
        return {"Authorization": f"Bearer {token}"}
    return {}
