"""
AtlasStack API Gateway
Main FastAPI application entry point
"""

from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Request, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
try:
    from opentelemetry import trace
    from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
    from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
    from opentelemetry.sdk.trace import TracerProvider
    from opentelemetry.sdk.trace.export import BatchSpanProcessor
    HAS_TELEMETRY = True
except ImportError:
    HAS_TELEMETRY = False
    # Stub for when opentelemetry is not installed
    class _TracerStub:
        def get_tracer(self, *a, **kw): return self
        def start_as_current_span(self, *a, **kw):
            from contextlib import contextmanager
            @contextmanager
            def _noop(): yield
            return _noop()
    trace = _TracerStub()

from core.config import settings
from core.database import close_db, init_db
from middleware.auth import AuthMiddleware
from middleware.logging import LoggingMiddleware
from middleware.rate_limit import RateLimitMiddleware
from routers import analysis, auth, health, repository

logger = structlog.get_logger()
tracer = trace.get_tracer(__name__) if HAS_TELEMETRY else None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info("Starting AtlasStack API Gateway")
    await init_db()
    logger.info("Database initialized")

    yield

    # Shutdown
    logger.info("Shutting down AtlasStack API Gateway")
    await close_db()
    logger.info("Database connections closed")


# Create FastAPI application
app = FastAPI(
    title="AtlasStack API",
    description="AI-powered code analysis platform",
    version="1.0.0",
    docs_url="/docs" if settings.DEBUG else None,
    redoc_url="/redoc" if settings.DEBUG else None,
    lifespan=lifespan,
)

# Add middleware (order matters - first added = first executed)
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(LoggingMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(AuthMiddleware)

# Instrument with OpenTelemetry
if HAS_TELEMETRY:
    try:
        FastAPIInstrumentor.instrument_app(app)
    except Exception as e:
        logger.warning(f"Failed to instrument app: {e}")

# Include routers
app.include_router(health.router, tags=["Health"])
app.include_router(auth.router, prefix="/api/v1", tags=["Auth"])
app.include_router(repository.router, prefix="/api/v1", tags=["Repositories"])
app.include_router(analysis.router, prefix="/api/v1", tags=["Analysis"])


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler"""
    logger.error(
        "Unhandled exception",
        error=str(exc),
        path=request.url.path,
        method=request.method,
    )
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"},
    )


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "name": "AtlasStack API",
        "version": "1.0.0",
        "documentation": "/docs",
        "health": "/health",
        "endpoints": {
            "auth": "/api/v1/auth",
            "repositories": "/api/v1/repositories",
            "analysis": "/api/v1/analysis",
            "analyses_history": "/api/v1/analyses",
        },
    }


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time updates"""
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_json()
            # Handle different message types
            message_type = data.get("type")

            if message_type == "subscribe":
                # Subscribe to analysis updates
                analysis_id = data.get("analysis_id")
                await websocket.send_json(
                    {
                        "type": "subscribed",
                        "analysis_id": analysis_id,
                    }
                )
            elif message_type == "ping":
                await websocket.send_json({"type": "pong"})
            else:
                await websocket.send_json(
                    {
                        "type": "error",
                        "message": f"Unknown message type: {message_type}",
                    }
                )
    except Exception as e:
        logger.warning(f"WebSocket connection closed: {e}")
    finally:
        await websocket.close()


# Setup OpenTelemetry
def setup_telemetry():
    """Configure OpenTelemetry tracing (no-op if opentelemetry not installed)."""
    if not HAS_TELEMETRY:
        return
    if settings.OTEL_EXPORTER_OTLP_ENDPOINT:
        provider = TracerProvider()
        exporter = OTLPSpanExporter(endpoint=settings.OTEL_EXPORTER_OTLP_ENDPOINT)
        processor = BatchSpanProcessor(exporter)
        provider.add_span_processor(processor)
        trace.set_tracer_provider(provider)
        logger.info("OpenTelemetry tracing configured")


setup_telemetry()

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower(),
    )
