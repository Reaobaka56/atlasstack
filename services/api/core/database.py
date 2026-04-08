"""
Database connection management - improved with proper SQLite schema, user persistence,
and analysis result storage.
"""

import asyncio
from contextlib import asynccontextmanager
from typing import AsyncGenerator, Optional

import structlog
import redis.asyncio as redis
from sqlalchemy import Column, DateTime, String, Integer, Float, Boolean, Text, JSON, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from datetime import datetime

from core.config import settings

logger = structlog.get_logger()


class Base(DeclarativeBase):
    pass


class UserRecord(Base):
    __tablename__ = "users"
    id = Column(String, primary_key=True)
    email = Column(String, unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    roles = Column(JSON, default=list)
    created_at = Column(DateTime, default=datetime.utcnow)
    is_active = Column(Boolean, default=True)
    github_token = Column(String, nullable=True)


class RepositoryRecord(Base):
    __tablename__ = "repositories"
    id = Column(String, primary_key=True)
    user_id = Column(String, nullable=False, index=True)
    url = Column(String, nullable=False)
    name = Column(String, nullable=False)
    branch = Column(String, default="main")
    description = Column(Text, nullable=True)
    status = Column(String, default="pending")
    last_analyzed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class AnalysisRecord(Base):
    __tablename__ = "analyses"
    id = Column(String, primary_key=True)
    repo_id = Column(String, nullable=False, index=True)
    user_id = Column(String, nullable=False)
    repo_url = Column(String, nullable=False)
    status = Column(String, default="pending")
    health_score = Column(Integer, nullable=True)
    summary = Column(Text, nullable=True)
    eli5_summary = Column(Text, nullable=True)
    tech_stack = Column(JSON, nullable=True)
    important_files = Column(JSON, nullable=True)
    fixes = Column(JSON, nullable=True)
    dependencies = Column(JSON, nullable=True)
    errors = Column(JSON, nullable=True)
    run_steps = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)


# SQLAlchemy async engine
if settings.LITE_MODE:
    engine = create_async_engine(
        "sqlite+aiosqlite:///./atlasstack_lite.db",
        echo=settings.DEBUG,
    )
else:
    engine = create_async_engine(
        settings.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://"),
        pool_size=settings.DATABASE_POOL_SIZE,
        max_overflow=settings.DATABASE_MAX_OVERFLOW,
        pool_pre_ping=True,
        echo=settings.DEBUG,
    )

AsyncSessionLocal = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)

redis_pool: Optional[redis.Redis] = None


async def init_db():
    """Initialize database connections and create tables."""
    global redis_pool

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database initialized and tables created")

    if settings.LITE_MODE:
        logger.info("Running in LITE_MODE: Bypassing Redis initialization")
        redis_pool = None
    else:
        redis_pool = redis.from_url(
            settings.REDIS_URL,
            max_connections=settings.REDIS_POOL_SIZE,
            decode_responses=True,
        )
        await redis_pool.ping()
        logger.info("Redis connection established")


async def close_db():
    """Close database connections."""
    await engine.dispose()
    logger.info("Database connection closed")
    if redis_pool:
        await redis_pool.close()
        logger.info("Redis connection closed")


@asynccontextmanager
async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


async def get_redis() -> redis.Redis:
    if redis_pool is None:
        raise RuntimeError("Redis not initialized")
    return redis_pool
