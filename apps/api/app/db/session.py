"""Engine y sesión de base de datos.

El engine se crea una sola vez fuera del handler (sección 4): en Lambda, el módulo se
importa una vez por contenedor cálido y el engine se reutiliza entre invocaciones; cada
request obtiene una Session nueva que se cierra siempre. Nunca compartir Session o
transacción entre invocaciones.
"""

from __future__ import annotations

from collections.abc import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import get_settings

settings = get_settings()

engine: Engine = create_engine(
    settings.database_url,
    pool_size=settings.db_pool_size,
    max_overflow=settings.db_max_overflow,
    pool_pre_ping=True,
)


@event.listens_for(engine, "connect")
def _set_statement_timeout(dbapi_connection, connection_record) -> None:  # noqa: ANN001
    """Fija `statement_timeout` con `SET` tras conectar, no con `options` de libpq
    en `connect_args`: RDS Proxy rechaza esa forma ("Feature not supported: RDS
    Proxy currently doesn't support command-line options"), descubierto en el
    primer despliegue real contra el proxy (sección 4, [S2])."""
    cursor = dbapi_connection.cursor()
    cursor.execute(f"SET statement_timeout = {settings.db_statement_timeout_ms}")
    cursor.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
