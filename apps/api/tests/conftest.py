"""Fixtures de pruebas contra PostgreSQL real (sección 19: "pruebas de negocio con
DB real para transacciones, no solo mocks del repositorio").

Usa una base de datos separada `aula_test` (misma instancia Postgres del Docker
Compose local) para no interferir con los datos de `make seed`. Cada test corre en
una transacción con SAVEPOINT que se revierte al final, así los tests no interfieren
entre sí ni dejan datos persistentes.
"""

from __future__ import annotations

import os
import uuid
from collections.abc import Generator

import psycopg
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import Session, sessionmaker

os.environ.setdefault("APP_ENV", "local")
os.environ.setdefault("LOCAL_AUTH_ENABLED", "true")

BASE_ADMIN_URL = os.environ.get(
    "TEST_ADMIN_DATABASE_URL", "postgresql+psycopg://aula:aula@localhost:5432/aula"
)
TEST_DB_NAME = "aula_test"
TEST_DATABASE_URL = os.environ.get(
    "DATABASE_URL", f"postgresql+psycopg://aula:aula@localhost:5432/{TEST_DB_NAME}"
)
os.environ["DATABASE_URL"] = TEST_DATABASE_URL


def _ensure_test_database() -> None:
    admin_conninfo = BASE_ADMIN_URL.replace("postgresql+psycopg://", "postgresql://")
    with psycopg.connect(admin_conninfo, autocommit=True) as conn:
        exists = conn.execute(
            "SELECT 1 FROM pg_database WHERE datname = %s", (TEST_DB_NAME,)
        ).fetchone()
        if not exists:
            conn.execute(f'CREATE DATABASE "{TEST_DB_NAME}"')


_ensure_test_database()

from app.db.base import Base  # noqa: E402
from app.modules.academics import models as academics_models  # noqa: E402,F401
from app.modules.files import models as files_models  # noqa: E402,F401
from app.modules.identity import models as identity_models  # noqa: E402,F401
from app.modules.learning import models as learning_models  # noqa: E402,F401

engine = create_engine(TEST_DATABASE_URL)
Base.metadata.drop_all(engine)
Base.metadata.create_all(engine)

TestSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


@pytest.fixture()
def db_session() -> Generator[Session, None, None]:
    connection = engine.connect()
    outer_txn = connection.begin()
    session = TestSessionLocal(bind=connection)
    session.begin_nested()

    @event.listens_for(session, "after_transaction_end")
    def _restart_savepoint(sess, transaction):
        if transaction.nested and not transaction._parent.nested:
            sess.begin_nested()

    try:
        yield session
    finally:
        session.close()
        outer_txn.rollback()
        connection.close()


@pytest.fixture()
def client(db_session: Session) -> Generator[TestClient, None, None]:
    from app.db.session import get_db
    from app.main import app

    def _override_get_db() -> Generator[Session, None, None]:
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture()
def unique_suffix() -> str:
    return uuid.uuid4().hex[:8]
