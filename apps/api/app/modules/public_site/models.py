"""Contenido administrable del sitio público (apps/public_web).

Vive en el schema `content` de la misma base Postgres de aula virtual, separado del
schema `public` donde están las tablas de la app privada (sección 7: mismo motor,
límite de dominio explícito vía schema en vez de un servidor/DB aparte). Primer
recurso: noticias; el módulo crece con más contenido público más adelante.
"""

from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin, UUIDPKMixin

CONTENT_SCHEMA = "content"


class NewsPost(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "news_posts"
    __table_args__ = {"schema": CONTENT_SCHEMA}

    title: Mapped[str] = mapped_column(nullable=False)
    slug: Mapped[str] = mapped_column(nullable=False, unique=True)
    excerpt: Mapped[str | None] = mapped_column(nullable=True)
    body: Mapped[str] = mapped_column(nullable=False)
    cover_image_url: Mapped[str | None] = mapped_column(nullable=True)
    # "draft" | "published" (sin tabla de catálogo aparte: mismo patrón que
    # `files.status`/`schools.status` en el resto de la base de código).
    status: Mapped[str] = mapped_column(nullable=False, default="draft")
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    author_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
