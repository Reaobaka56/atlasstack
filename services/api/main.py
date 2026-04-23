"""
AtlasStack API Gateway
Main FastAPI application entry point
"""

from contextlib import asynccontextmanager

import structlog
from fastapi import FastAPI, Depends, HTTPException, Request, Response, WebSocket, Query
from starlette.middleware.base import BaseHTTPMiddleware
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
import time
import logging
import os
import json
import re
from datetime import datetime
from huggingface_hub import InferenceClient

from middleware.auth import verify_token
from tenacity import retry, stop_after_attempt, wait_exponential

# Analytics Middleware
class AnalyticsMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        start_time = time.time()
        
        # Try to identify user
        user_id = "anonymous"
        if hasattr(request.state, "user"):
            user_id = request.state.user.get("id", "anonymous")
            
        response = await call_next(request)
        
        process_time = time.time() - start_time
        structlog.get_logger().info(
            "request_log",
            path=request.url.path,
            method=request.method,
            status_code=response.status_code,
            duration_ms=int(process_time * 1000),
            user_id=user_id
        )
        return response

# LLM Retry Logic
@retry(
    stop=stop_after_attempt(3),
    wait=wait_exponential(multiplier=1, min=2, max=10),
    reraise=True
)
async def call_llm_with_retry(client, model, messages, max_tokens, temperature):
    return client.chat.completions.create(
        model=model,
        messages=messages,
        max_tokens=max_tokens,
        temperature=temperature
    )
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
from routers import analysis, auth, health, repository, graph_router

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
app.add_middleware(AnalyticsMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=settings.CORS_ORIGIN_REGEX,
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
app.include_router(graph_router.router)


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
async def websocket_endpoint(websocket: WebSocket, token: str = Query(None)):
    """WebSocket endpoint for real-time updates"""
    if not token:
        await websocket.close(code=1008, reason="Unauthorized")
        return

    decoded = verify_token(token)
    if not decoded:
        await websocket.close(code=1008, reason="Unauthorized")
        return
        
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
            elif message_type == "chat":
                # Handle AI chat
                user_text = data.get("text", "")
                hf_token = os.environ.get("HF_TOKEN") or os.environ.get("HUGGING_FACE_HUB_TOKEN")
                
                if not hf_token:
                    await websocket.send_json({
                        "type": "chat_response",
                        "text": "HF_TOKEN is not set in the backend .env. Please configure it to enable AI chat."
                    })
                    continue

                try:
                    client = InferenceClient(api_key=hf_token)
                    prompt = f"You are AtlasStack AI, a premium code architect. Answer the user's question concisely: {user_text}"
                    
                    response = await call_llm_with_retry(
                        client=client,
                        model="Qwen/Qwen2.5-Coder-32B-Instruct",
                        messages=[{"role": "user", "content": prompt}],
                        max_tokens=1000,
                        temperature=0.7
                    )
                    
                    ai_text = response.choices[0].message.content
                    await websocket.send_json({
                        "type": "chat_response",
                        "text": ai_text
                    })
                except Exception as chat_err:
                    logger.error(f"Chat generation error: {chat_err}")
                    await websocket.send_json({
                        "type": "chat_response",
                        "text": f"Sorry, I encountered an error: {str(chat_err)}"
                    })
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
    import os

    # Render provides PORT environment variable
    port = int(os.environ.get("PORT", 8005))

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=port,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower(),
    )
