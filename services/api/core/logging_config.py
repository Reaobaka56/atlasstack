import logging
import sys
from pythonjsonlogger import jsonlogger
import structlog
from core.config import settings

def setup_logging():
    """Setup structured logging for the application"""
    
    # Standard logging configuration
    handler = logging.StreamHandler(sys.stdout)
    if settings.ENVIRONMENT == "production":
        formatter = jsonlogger.JsonFormatter(
            "%(asctime)s %(levelname)s %(name)s %(message)s"
        )
        handler.setFormatter(formatter)
    
    logging.basicConfig(
        level=settings.LOG_LEVEL,
        handlers=[handler]
    )

    # Structlog configuration
    structlog.configure(
        processors=[
            structlog.stdlib.add_log_level,
            structlog.stdlib.PositionalArgumentsFormatter(),
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer() if settings.ENVIRONMENT == "production" else structlog.dev.ConsoleRenderer(),
        ],
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )

def get_logger(name: str):
    """Get a structured logger"""
    return structlog.get_logger(name)
