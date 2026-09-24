from __future__ import annotations

import uuid

from sqlalchemy import ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, SchoolScopedMixin, TimestampMixin, UUIDPKMixin


class File(UUIDPKMixin, TimestampMixin, SchoolScopedMixin, Base):
    """Adjunto privado de una tarea o una entrega (sección 5/9). Nunca público: se
    descarga vía URL firmada de corta duración en cloud, o servido por la propia API
    tras reverificar autorización en local (sin S3 real, sección 17).

    `attached_to_type`/`attached_to_id` es polimórfico a propósito ("assignment" |
    "submission") para no duplicar esta tabla; sin índice único ni FK real hacia
    ambos padres (bajo volumen esperado en este alcance, documentado igual que el
    resto de referencias sin FK compuesta en `db/base.py::SchoolScopedMixin`)."""

    __tablename__ = "files"

    owner_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    attached_to_type: Mapped[str] = mapped_column(nullable=False)
    attached_to_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), nullable=False, index=True
    )
    filename: Mapped[str] = mapped_column(nullable=False)
    content_type: Mapped[str] = mapped_column(nullable=False)
    size_bytes: Mapped[int] = mapped_column(nullable=False)
    storage_key: Mapped[str] = mapped_column(nullable=False)
    # Adaptador ficticio (sección 17, docs/IMPLEMENTATION_STATUS.md): "available" en
    # cuanto pasa la validación de tipo/tamaño, sin escaneo antimalware real todavía.
    status: Mapped[str] = mapped_column(nullable=False, default="available")
