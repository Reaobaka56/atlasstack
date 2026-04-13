"""
Authentication — bcrypt password hashing, JWT tokens, and a FastAPI dependency-based
auth system.

We use a FastAPI startup hook + router-level dependency instead of middleware,
because Starlette's middleware stack has subtle scope-sharing issues between
BaseHTTPMiddleware wrappers (GZipMiddleware, LoggingMiddleware) that can cause
pure-ASGI middleware state to be lost. The dependency approach is more reliable
and idiomatic for FastAPI.
"""

from datetime import datetime, timedelta
from typing import Optional

import bcrypt
import structlog
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from core.config import settings

logger = structlog.get_logger()
_bearer = HTTPBearer(auto_error=False)

# ── Password hashing ──────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


# ── JWT helpers ───────────────────────────────────────────────────────────────

def create_access_token(
    user_id: str,
    email: str,
    roles: Optional[list] = None,
    expires_delta: Optional[timedelta] = None,
) -> str:
    expire = datetime.utcnow() + (expires_delta or timedelta(hours=settings.JWT_EXPIRATION_HOURS))
    return jwt.encode(
        {"sub": user_id, "email": email, "roles": roles or [],
         "exp": expire, "iat": datetime.utcnow(), "type": "access"},
        settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM,
    )


def create_refresh_token(user_id: str) -> str:
    expire = datetime.utcnow() + timedelta(days=7)
    return jwt.encode(
        {"sub": user_id, "exp": expire, "iat": datetime.utcnow(), "type": "refresh"},
        settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM,
    )


def create_reset_token(user_id: str, email: str) -> str:
    expire = datetime.utcnow() + timedelta(hours=1)
    return jwt.encode(
        {"sub": user_id, "email": email, "exp": expire, "iat": datetime.utcnow(), "type": "reset"},
        settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM,
    )


def verify_token(token: str) -> Optional[dict]:
    try:
        return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
    except JWTError:
        return None


# ── FastAPI dependency-based auth ─────────────────────────────────────────────

def _decode_bearer(request: Request) -> Optional[dict]:
    """Extract and decode a JWT from the Authorization header. Returns payload or None."""
    auth = request.headers.get("Authorization", "")
    if not auth.lower().startswith("bearer "):
        return None
    token = auth[7:].strip()
    return verify_token(token)


def get_current_user(request: Request) -> dict:
    """
    FastAPI dependency that requires a valid JWT.
    Raises 401 if missing/invalid, 403 if token type is wrong.
    """
    payload = _decode_bearer(request)
    if payload is None:
        raise HTTPException(status_code=401, detail="Invalid or missing authentication token")
    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Refresh tokens cannot be used for API access")
    return {
        "id": payload["sub"],
        "email": payload.get("email", ""),
        "roles": payload.get("roles", []),
    }


class PermissionChecker:
    """
    FastAPI dependency that ensures the current user has at least one of the required roles.
    Usage: Depends(PermissionChecker(["user"]))
    """
    def __init__(self, required_roles: list):
        self.required_roles = required_roles

    def __call__(self, user: dict = Depends(get_current_user)) -> dict:
        user_roles = set(user.get("roles", []))
        if not any(role in user_roles for role in self.required_roles):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return user


# ── Thin middleware for logging the authenticated user on each request ─────────

PUBLIC_PATHS = {
    "/", "/health", "/ready", "/live", "/metrics",
    "/docs", "/redoc", "/openapi.json",
    "/api/v1/auth/login", "/api/v1/auth/register", "/api/v1/auth/refresh",
    "/api/v1/auth/forgot-password", "/api/v1/auth/verify-otp", "/api/v1/auth/reset-password",
    "/api/v1/analysis/mvp",
}


class AuthMiddleware(BaseHTTPMiddleware):
    """
    Lightweight middleware that annotates request.state.user when a valid token
    is present — used for logging/metrics only. Authorization enforcement is done
    via PermissionChecker dependency on each route, which is more reliable than
    middleware-based enforcement in FastAPI's middleware stack.
    """

    async def dispatch(self, request: Request, call_next):
        if request.method != "OPTIONS":
            payload = _decode_bearer(request)
            if payload:
                request.state.user = {
                    "id": payload.get("sub"),
                    "email": payload.get("email"),
                    "roles": payload.get("roles", []),
                }
        return await call_next(request)
