"""
Authentication endpoints - improved with real user persistence and password hashing.
"""

import uuid
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db, UserRecord
from middleware.auth import (
    create_access_token, create_refresh_token,
    hash_password, verify_password, verify_token
)

router = APIRouter()


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    roles: List[str] = Field(default_factory=lambda: ["user"])


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in_hours: int = 24
    user_id: str
    email: str


class RefreshRequest(BaseModel):
    refresh_token: str


@router.post("/auth/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a new user with hashed password stored persistently."""
    # Check if email already exists
    result = await db.execute(select(UserRecord).where(UserRecord.email == payload.email))
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists",
        )

    user_id = str(uuid.uuid4())
    user = UserRecord(
        id=user_id,
        email=payload.email,
        hashed_password=hash_password(payload.password),
        roles=payload.roles,
    )
    db.add(user)
    await db.commit()

    access_token = create_access_token(user_id=user_id, email=payload.email, roles=payload.roles)
    refresh_token = create_refresh_token(user_id=user_id)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=user_id,
        email=payload.email,
    )


@router.post("/auth/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Login with email/password, verifying against stored hash."""
    result = await db.execute(select(UserRecord).where(UserRecord.email == payload.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is disabled",
        )

    access_token = create_access_token(user_id=user.id, email=user.email, roles=user.roles)
    refresh_token = create_refresh_token(user_id=user.id)
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user_id=user.id,
        email=user.email,
    )


@router.post("/auth/refresh", response_model=TokenResponse)
async def refresh_token(payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    """Issue a fresh token pair using a valid refresh token."""
    decoded = verify_token(payload.refresh_token)
    if not decoded or decoded.get("type") != "refresh":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    user_id = decoded.get("sub")
    result = await db.execute(select(UserRecord).where(UserRecord.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    access_token = create_access_token(user_id=user.id, email=user.email, roles=user.roles)
    new_refresh = create_refresh_token(user_id=user.id)
    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh,
        user_id=user.id,
        email=user.email,
    )


@router.get("/auth/me")
async def get_me(db: AsyncSession = Depends(get_db), request=None):
    """Get current user info - handled via request.state.user in middleware."""
    # This is a placeholder; actual user extraction handled by PermissionChecker
    return {"message": "Use Authorization header to identify yourself"}


class GithubAuthRequest(BaseModel):
    code: str


@router.get("/auth/github/login")
async def github_login():
    """Return the GitHub OAuth authorize URL"""
    from core.config import get_settings
    settings = get_settings()
    client_id = settings.GITHUB_CLIENT_ID
    if not client_id:
        raise HTTPException(status_code=500, detail="GitHub Client ID not configured")
    # You can return the URL so the frontend can redirect
    url = f"https://github.com/login/oauth/authorize?client_id={client_id}&scope=repo user:email"
    return {"url": url}


@router.post("/auth/github/callback", response_model=TokenResponse)
async def github_callback(payload: GithubAuthRequest, db: AsyncSession = Depends(get_db)):
    """Exchange code for token and login/register user"""
    import httpx
    import secrets
    from core.config import get_settings
    settings = get_settings()
    
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data={
                "client_id": settings.GITHUB_CLIENT_ID,
                "client_secret": settings.GITHUB_CLIENT_SECRET,
                "code": payload.code
            }
        )
        data = resp.json()
        token = data.get("access_token")
        if not token:
            raise HTTPException(status_code=400, detail="Invalid GitHub code or missing token")

        # get user info
        user_resp = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"token {token}", "Accept": "application/vnd.github.v3+json"}
        )
        user_data = user_resp.json()
        email = user_data.get("email")

        # if email is hidden
        if not email:
            email_resp = await client.get(
                "https://api.github.com/user/emails",
                headers={"Authorization": f"token {token}", "Accept": "application/vnd.github.v3+json"}
            )
            emails = email_resp.json()
            primary = next((e for e in emails if e.get("primary")), emails[0] if emails else None)
            if primary:
                email = primary.get("email")
            
        if not email:
            raise HTTPException(status_code=400, detail="No email associated with GitHub account")

        # login or register
        result = await db.execute(select(UserRecord).where(UserRecord.email == email))
        user = result.scalar_one_or_none()
        if not user:
            user_id = str(uuid.uuid4())
            user = UserRecord(
                id=user_id,
                email=email,
                hashed_password=hash_password(secrets.token_urlsafe(16)),
                roles=["user"],
                github_token=token
            )
            db.add(user)
        else:
            user.github_token = token
            
        await db.commit()
    
        access_token = create_access_token(user_id=user.id, email=user.email, roles=user.roles)
        refresh_token = create_refresh_token(user_id=user.id)
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user_id=user.id,
            email=user.email
        )

@router.get("/auth/github/repos")
async def get_github_repos(db: AsyncSession = Depends(get_db), req: Request = None):
    user_context = getattr(req.state, "user", None)
    if not user_context:
        raise HTTPException(status_code=401, detail="Must be logged in to fetch repos")
    
    result = await db.execute(select(UserRecord).where(UserRecord.id == user_context["id"]))
    user = result.scalar_one_or_none()
    if not user or not user.github_token:
        raise HTTPException(status_code=403, detail="GitHub account not linked")

    import httpx
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://api.github.com/user/repos?sort=updated&per_page=50",
            headers={"Authorization": f"token {user.github_token}", "Accept": "application/vnd.github.v3+json"}
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail="Failed to fetch repos from GitHub")
        return [{"name": r["full_name"], "url": r["html_url"], "private": r["private"]} for r in resp.json()]
