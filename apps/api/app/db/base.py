"""Base declarativa y mixins comunes (sección 7 del documento de arquitectura).

Convenciones: UUID como PK, snake_case, created_at/updated_at timestamptz,
school_id en tablas de dominio. Importes NUMERIC, nunca float (se aplica en los
módulos que manejen dinero; no hay ninguno en esta entrega).
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class UUIDPKMixin:
    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class SchoolScopedMixin:
    """`school_id` obligatorio en tablas de dominio (sección 7). La validación de que
    el `school_id` coincide con el de las entidades padre se hace en la capa de
    servicio (ver `modules/*/service.py`); queda documentado en
    `docs/IMPLEMENTATION_STATUS.md` como hardening pendiente reforzar con FKs
    compuestas adicionales en una fase posterior."""

    school_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("schools.id"), nullable=False, index=True
    )
