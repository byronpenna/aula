"""Engine y sesión de base de datos.

El engine se crea una sola vez fuera del handler (sección 4): en Lambda, el módulo se
importa una vez por contenedor cálido y el engine se reutiliza entre invocaciones; cada
request obtiene una Session nueva que se cierra siempre. Nunca compartir Session o
transacción entre invocaciones.
"""

from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

settings = get_settings()

engine: Engine = create_engine(
    settings.database_url,
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
    pool_pre_ping=True,
    connect_args={
        "options": f"-c statement_timeout={settings.db_statement_timeout_ms}",
    },
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
