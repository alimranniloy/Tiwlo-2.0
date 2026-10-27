"""OpenBiometrics -- FastAPI application entry point.

Run with: uvicorn app.main:app --host 0.0.0.0 --port 8000
"""

from __future__ import annotations

import logging
import hmac
import os
import time
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.formparsers import MultiPartParser

from app import deps
from app.routes import router as api_router
from openbiometrics import __version__
from openbiometrics.config import (
    BiometricConfig,
    DocumentConfig,
    EventsConfig,
    FaceConfig,
    IdentityConfig,
    LivenessConfig,
    PersonConfig,
    VideoConfig,
)

logger = logging.getLogger("openbiometrics.api")

# The authenticated Node endpoint caps each image at 10 MiB; keep each upload
# below Starlette's spool threshold so biometric bytes are not written to temp files.
MultiPartParser.spool_max_size = 11 * 1024 * 1024

DASHBOARD_DIR = Path(__file__).parent.parent.parent / "packages" / "dashboard" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    models_dir = os.environ.get(
        "OPENBIOMETRICS_MODEL_DIR",
        str(Path(__file__).parent.parent.parent / "engine" / "models"),
    )

    config = BiometricConfig(
        face=FaceConfig(
            models_dir=models_dir,
            ctx_id=-1,
            enable_demographics=False,
        ),
        document=DocumentConfig(enabled=False, models_dir=models_dir),
        liveness=LivenessConfig(
            enabled=True,
            models_dir=models_dir,
            num_challenges=4,
            timeout_seconds=12.0,
        ),
        person=PersonConfig(enabled=False, models_dir=models_dir),
        video=VideoConfig(enabled=False),
        events=EventsConfig(enabled=False, webhooks_enabled=False),
        identity=IdentityConfig(enabled=False),
    )

    deps.init_services(config)

    kernel = deps.get_kernel()
    health = kernel.health()
    print("OpenBiometrics ready.")
    print(f"  Models: {models_dir}")
    print(f"  Device: {'GPU:' + str(config.face.ctx_id) if config.face.ctx_id >= 0 else 'CPU'}")
    print(f"  Modules: {', '.join(m for m, ok in health.modules.items() if ok)}")

    yield

    deps.shutdown_services()
    print("Shutting down.")


app = FastAPI(
    title="OpenBiometrics",
    description="Open-source biometric platform -- face detection, recognition, liveness, quality",
    version=__version__,
    lifespan=lifespan,
)

@app.middleware("http")
async def require_internal_api_token(request: Request, call_next):
    if request.url.path.startswith("/api/v1/") and request.url.path != "/api/v1/health":
        expected = os.environ.get("OPENBIOMETRICS_SHARED_TOKEN", "")
        supplied = request.headers.get("x-tiwlo-biometrics-token", "")
        if not expected:
            return JSONResponse(status_code=503, content={"detail": "Internal API is not configured"})
        if not hmac.compare_digest(supplied, expected):
            return JSONResponse(status_code=403, content={"detail": "Forbidden"})
    return await call_next(request)


# -- Audit logging middleware --------------------------------------------------

@app.middleware("http")
async def audit_log_middleware(request: Request, call_next):
    """Log every request with method, path, status code, duration, and version header."""
    start = time.monotonic()
    response = await call_next(request)
    duration_ms = (time.monotonic() - start) * 1000
    response.headers["X-OpenBiometrics-Version"] = __version__
    response.headers["Cache-Control"] = "no-store"
    logger.info(
        "%s %s -> %d (%.1fms)",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )
    return response


# -- Routes --------------------------------------------------------------------

app.include_router(api_router, prefix="/api/v1")

# Serve React dashboard
if DASHBOARD_DIR.exists():
    app.mount("/", StaticFiles(directory=str(DASHBOARD_DIR), html=True), name="dashboard")
