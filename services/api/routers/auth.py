"""
Authentication endpoints - improved with real user persistence and password hashing.
"""

import uuid
from typing import List

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db, UserRecord, OTPRecord
from middleware.auth import (
    create_access_token, create_refresh_token, create_reset_token,
    hash_password, verify_password, verify_token
)
from utils.email import send_otp_email
from utils.security import encrypt_token, decrypt_token

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
    is_pro: bool = False


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


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class VerifyOTPRequest(BaseModel):
    email: EmailStr
    otp: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)


# OTP Helpers
import time
import random
import string
from datetime import datetime, timedelta

def _generate_otp() -> str:
    """Generate a 6-digit numeric OTP."""
    return ''.join(random.choices(string.digits, k=6))


@router.post("/auth/forgot-password")
async def forgot_password(
    payload: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """Send a 6-digit OTP to the user's email for password reset verification."""
    # Cleanup expired OTPs in DB
    await db.execute(delete(OTPRecord).where(OTPRecord.expires_at < datetime.utcnow()))

    result = await db.execute(select(UserRecord).where(UserRecord.email == payload.email))
    user = result.scalar_one_or_none()

    if user and user.is_active:
        otp = _generate_otp()
        # UPSERT OTP: Overwrite any existing OTP for this email
        await db.execute(delete(OTPRecord).where(OTPRecord.email == payload.email.lower()))
        
        new_otp = OTPRecord(
            email=payload.email.lower(),
            otp=otp,
            user_id=user.id,
            expires_at=datetime.utcnow() + timedelta(minutes=10)
        )
        db.add(new_otp)
        await db.commit()
        background_tasks.add_task(send_otp_email, payload.email, otp)

    # Always return success to prevent email enumeration
    return {"message": "If an account with that email exists, a verification code has been sent."}


@router.post("/auth/verify-otp")
async def verify_otp(
    payload: VerifyOTPRequest,
    db: AsyncSession = Depends(get_db),
):
    """Verify the 6-digit OTP and return a reset token if valid."""
    email_key = payload.email.lower()
    
    # Refresh/Cleanup check
    await db.execute(delete(OTPRecord).where(OTPRecord.expires_at < datetime.utcnow()))

    result = await db.execute(select(OTPRecord).where(OTPRecord.email == email_key))
    stored = result.scalar_one_or_none()

    if not stored:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired verification code.",
        )

    if stored.otp != payload.otp.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect verification code.",
        )

    # OTP is valid — issue a reset token and remove the OTP
    user_id = stored.user_id
    await db.delete(stored)
    await db.commit()

    reset_token = create_reset_token(user_id=user_id, email=payload.email)
    return {"reset_token": reset_token, "message": "Code verified. You may now reset your password."}


@router.post("/auth/reset-password")
async def reset_password(
    payload: ResetPasswordRequest,
    db: AsyncSession = Depends(get_db),
):
    """Reset password using a valid reset token (obtained after OTP verification)."""
    decoded = verify_token(payload.token)
    if not decoded or decoded.get("type") != "reset":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    user_id = decoded.get("sub")
    result = await db.execute(select(UserRecord).where(UserRecord.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset token",
        )

    user.hashed_password = hash_password(payload.new_password)
    await db.commit()
    return {"message": "Password has been reset successfully. You can now sign in."}


class GithubAuthRequest(BaseModel):
    code: str


@router.get("/auth/github/login")
async def github_login(request: Request):
    """Return the GitHub OAuth authorize URL — frontend redirects user there."""
    from core.config import get_settings
    settings = get_settings()
    client_id = settings.GITHUB_CLIENT_ID
    if not client_id:
        raise HTTPException(status_code=500, detail="GitHub Client ID not configured")

    # The redirect_uri must match what's registered in your GitHub OAuth App settings.
    # It should point to your FRONTEND so the ?code= param lands back in the React app.
    origin = request.headers.get("origin") or request.headers.get("referer", "http://localhost:5173")
    # Strip trailing slash/path — keep just origin
    import re
    origin_match = re.match(r"(https?://[^/]+)", origin)
    frontend_origin = origin_match.group(1) if origin_match else "http://localhost:5173"
    redirect_uri = frontend_origin  # GitHub sends ?code= back to this URL

    url = (
        f"https://github.com/login/oauth/authorize"
        f"?client_id={client_id}"
        f"&redirect_uri={redirect_uri}"
        f"&scope=repo+user:email"
        f"&allow_signup=true"
    )
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
        
        encrypted_token = encrypt_token(token)
        
        if not user:
            user_id = str(uuid.uuid4())
            user = UserRecord(
                id=user_id,
                email=email,
                hashed_password=hash_password(secrets.token_urlsafe(16)),
                roles=["user"],
                github_token=encrypted_token
            )
            db.add(user)
        else:
            user.github_token = encrypted_token
            
        await db.commit()
    
        access_token = create_access_token(user_id=user.id, email=user.email, roles=user.roles)
        refresh_token = create_refresh_token(user_id=user.id)
        # Mark as pro if they have 'pro' in roles or for testing purposes
        is_pro = "pro" in (user.roles or [])
        return TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            user_id=user.id,
            email=user.email,
            is_pro=is_pro
        )

@router.get("/auth/github/repos")
async def get_github_repos(request: Request, db: AsyncSession = Depends(get_db)):
    """Fetch authenticated user's GitHub repos using their stored GitHub token."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Must be logged in to fetch repos")
    
    token_str = auth_header.split(" ", 1)[1]
    decoded = verify_token(token_str)
    if not decoded:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    user_id = decoded.get("sub")
    result = await db.execute(select(UserRecord).where(UserRecord.id == user_id))
    user = result.scalar_one_or_none()
    if not user or not user.github_token:
        raise HTTPException(status_code=403, detail="GitHub account not linked. Please sign in with GitHub.")

    # Decrypt token before use
    token = decrypt_token(user.github_token)

    import httpx
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://api.github.com/user/repos?sort=updated&per_page=50&affiliation=owner,collaborator",
            headers={"Authorization": f"token {token}", "Accept": "application/vnd.github.v3+json"}
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail="Failed to fetch repos from GitHub")
        return [{"name": r["full_name"], "url": r["html_url"], "private": r["private"], "default_branch": r.get("default_branch", "main")} for r in resp.json()]
