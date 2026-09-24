from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_logging, install_request_logging
from app.modules.academics.router import router as academics_router
from app.modules.files.router import router as files_router
from app.modules.identity.router import router as identity_router
from app.modules.learning.router import router as learning_router

settings = get_settings()
configure_logging(settings.app_env, settings.log_level)

app = FastAPI(
    title="Aula Virtual API",
    version="0.1.0",
    description="API de Aula Virtual. Ver ARQUITECTURA_AULA_VIRTUAL_CLAUDE.md.",
)

install_request_logging(app)
register_exception_handlers(app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

api_v1 = "/api/v1"
app.include_router(identity_router, prefix=api_v1)
app.include_router(academics_router, prefix=api_v1)
app.include_router(learning_router, prefix=api_v1)
app.include_router(files_router, prefix=api_v1)


@app.get("/healthz", tags=["ops"])
def liveness() -> dict:
    """Sin información interna (sección 14): no ejecuta consultas caras."""
    return {"status": "ok"}


@app.get("/readyz", tags=["ops"])
def readiness() -> dict:
    """Chequeo de DB liviano; no correr consultas caras cada pocos segundos."""
    from sqlalchemy import text

    from app.db.session import SessionLocal

    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ok"}
    finally:
        db.close()
