"""
Application configuration
Uses pydantic-settings for environment-based configuration
"""

from typing import List, Optional

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings"""

    # Application
    APP_NAME: str = "AtlasStack API"
    DEBUG: bool = True
    LOG_LEVEL: str = "INFO"
    ENVIRONMENT: str = "production"
    LITE_MODE: bool = True

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    WORKERS: int = 4

    # Database
    DATABASE_URL: str = "postgresql://atlasstack:atlasstack_secret@localhost:5432/atlasstack"
    DATABASE_POOL_SIZE: int = 20
    DATABASE_MAX_OVERFLOW: int = 10

    # Redis
    REDIS_URL: str = "redis://:redis_secret@localhost:6379/0"
    REDIS_POOL_SIZE: int = 10

    # Neo4j
    NEO4J_URI: str = "bolt://localhost:7687"
    NEO4J_USER: str = "neo4j"
    NEO4J_PASSWORD: str = "neo4j_secret"

    # Weaviate
    WEAVIATE_URL: str = "http://localhost:8080"

    # RabbitMQ / Celery
    RABBITMQ_URL: str = "amqp://atlasstack:rabbitmq_secret@localhost:5672/"
    CELERY_WORKER_CONCURRENCY: int = 4
    CELERY_TASK_ACKS_LATE: bool = True

    # Service URLs
    LLM_SERVICE_URL: str = "http://localhost:8001"
    KNOWLEDGE_SERVICE_URL: str = "http://localhost:8002"

    # JWT
    JWT_SECRET: str = "your-super-secret-jwt-key-change-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_HOURS: int = 24

    # Rate Limiting
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW: int = 60

    # CORS
    CORS_ORIGINS: List[str] = [
        # Local Development
        "http://localhost:3000",
        "http://localhost:3001",
        "http://localhost:5173",
        "http://localhost:8000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8000",
        "http://0.0.0.0:3000",
        "http://0.0.0.0:5173",
        # ✅ Docker Container Origins
        "http://web:80",
        "http://web",
        "http://web:5173",
        "http://localhost:80",
        # Production
        "https://atlasstack.ai",
    ]
    # Supports preview deployments (Vercel/Render) and local development ports.
    CORS_ORIGIN_REGEX: str = (
        r"^https://([a-zA-Z0-9-]+\.)*(atlasstack\.ai|vercel\.app|onrender\.com|railway\.app)$|"
        r"^http://(localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.\d+\.\d+|web|api)(:\d+)?$"
    )

    # Feature Flags
    ENABLE_SECURITY_SCANNING: bool = True
    ENABLE_PERFORMANCE_ANALYSIS: bool = True
    ENABLE_TAINT_ANALYSIS: bool = True
    ENABLE_KNOWLEDGE_GRAPH: bool = True
    ENABLE_VECTOR_SEARCH: bool = True

    # External APIs
    GITHUB_TOKEN: Optional[str] = None
    GITHUB_CLIENT_ID: Optional[str] = None
    GITHUB_CLIENT_SECRET: Optional[str] = None
    GITLAB_TOKEN: Optional[str] = None
    BITBUCKET_TOKEN: Optional[str] = None

    # SMTP Settings
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM_EMAIL: str = "noreply@atlasstack.ai"

    # Monitoring
    OTEL_EXPORTER_OTLP_ENDPOINT: Optional[str] = None
    PROMETHEUS_MULTIPROC_DIR: str = "/tmp"

    # LLM
    DEFAULT_MODEL: str = "codellama-7b"
    MAX_ANALYSIS_TIME: int = 300  # seconds

    # Encryption
    ENCRYPTION_KEY: Optional[str] = None

    class Config:
        env_file = ".env"
        case_sensitive = True
        extra = "allow"


# Global settings instance
settings = Settings()

import secrets as _secrets
import logging as _logging
import os as _os

def _validate_settings(s: "Settings"):
    if s.JWT_SECRET == "your-super-secret-jwt-key-change-in-production":
        msg = "CRITICAL: Using default JWT_SECRET! Set JWT_SECRET in .env immediately."
        if s.ENVIRONMENT == "production" and not s.LITE_MODE:
            raise ValueError(msg)
        else:
            _logging.warning(
                f"{msg} Suggested value: {_secrets.token_hex(32)}"
            )
    
    if not s.ENCRYPTION_KEY and s.ENVIRONMENT == "production":
         _logging.warning("WARNING: No ENCRYPTION_KEY set. Sensitive tokens will be stored in plaintext.")
    
    # Check for GITHUB_TOKEN in production
    if s.ENVIRONMENT == "production" and not s.GITHUB_TOKEN:
        _logging.warning("WARNING: GITHUB_TOKEN not set. API calls to GitHub will be rate-limited.")

# Run validation
_validate_settings(settings)


def get_settings() -> Settings:
    """Get application settings"""
    return settings
