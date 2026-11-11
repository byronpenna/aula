from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Boolean, DateTime, ForeignKey, Numeric, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, SchoolScopedMixin, TimestampMixin, UUIDPKMixin


class Assignment(UUIDPKMixin, TimestampMixin, SchoolScopedMixin, Base):
    __tablename__ = "assignments"

    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("courses.id"), nullable=False
    )
    title: Mapped[str] = mapped_column(nullable=False)
    instructions: Mapped[str] = mapped_column(nullable=False, default="")
    due_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    max_score: Mapped[Decimal] = mapped_column(Numeric(6, 2), nullable=False, default=100)
    status: Mapped[str] = mapped_column(nullable=False, default="draft")
    allow_late: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    grading_period_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("grading_periods.id"), nullable=True
    )


class Submission(UUIDPKMixin, TimestampMixin, SchoolScopedMixin, Base):
    __tablename__ = "submissions"
    __table_args__ = (
        UniqueConstraint("assignment_id", "student_id", name="uq_submission_assignment_student"),
    )

    assignment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("assignments.id"), nullable=False
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("student_profiles.id"), nullable=False
    )
    status: Mapped[str] = mapped_column(nullable=False, default="draft")
    # FK circular con submission_revisions: nombrada explícitamente para que
    # `Base.metadata.drop_all` (usado en tests) y Alembic puedan resolver el orden
    # de DROP CONSTRAINT; ver alembic/versions/..._fase_0_1.py para el ALTER TABLE
    # equivalente en la migración real.
    current_revision_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey(
            "submission_revisions.id",
            name="fk_submissions_current_revision_id_submission_revisions",
            use_alter=True,
        ),
        nullable=True,
    )
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    version: Mapped[int] = mapped_column(nullable=False, default=0)


class ResourceSection(UUIDPKMixin, TimestampMixin, SchoolScopedMixin, Base):
    """Carpeta de recursos (PDFs) de un curso. "active" | "deleted" (baja lógica,
    igual criterio que Course.status): eliminar una sección nunca borra sus
    archivos — siguen existiendo en `files` (attached_to_type="resource_section"),
    solo se saca la sección de los grupos visibles y sus PDFs se muestran
    agrupados como "Sin sección" (ver learning_service.get_course_resources)."""

    __tablename__ = "resource_sections"

    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("courses.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(nullable=False)
    status: Mapped[str] = mapped_column(nullable=False, default="active")


class ResourceLink(UUIDPKMixin, TimestampMixin, SchoolScopedMixin, Base):
    """Enlace externo agregado como recurso de una sección, al lado de los
    archivos (sección nueva): cualquier URL (video de YouTube/Facebook/TikTok,
    o una página web cualquiera) — no hay almacenamiento propio, solo se guarda
    la URL ya validada como absoluta (ver learning/service.py::_validate_url).
    Reconocer de qué proveedor es y si se puede incrustar una vista previa es
    puramente de presentación (ver apps/web/src/lib/linkPreview.ts): el backend
    nunca necesita saberlo. Mismo criterio de acceso que un archivo de la
    sección: cualquiera con acceso al curso puede verlo, solo quien administra
    el curso puede agregarlo o quitarlo."""

    __tablename__ = "resource_links"

    resource_section_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("resource_sections.id"), nullable=False, index=True
    )
    title: Mapped[str] = mapped_column(nullable=False)
    url: Mapped[str] = mapped_column(nullable=False)
    created_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )


class ResourceLinkComment(UUIDPKMixin, TimestampMixin, SchoolScopedMixin, Base):
    """Comentario interno sobre un video de recursos: a diferencia de FileNote
    (aclaración exclusiva de quien administra el curso sobre un PDF), este es un
    hilo de conversación abierto a cualquiera con acceso al curso —
    require_course_access tanto para leer como para comentar (ver
    learning/service.py::create_link_comment)."""

    __tablename__ = "resource_link_comments"

    resource_link_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("resource_links.id"), nullable=False, index=True
    )
    author_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    body: Mapped[str] = mapped_column(nullable=False)


class SubmissionRevision(UUIDPKMixin, Base):
    """Inmutable: nunca se hace UPDATE de una revisión existente, solo INSERT de la
    siguiente (sección 7 y 9)."""

    __tablename__ = "submission_revisions"
    __table_args__ = (
        UniqueConstraint("submission_id", "revision_number", name="uq_revision_per_submission"),
    )

    submission_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("submissions.id"), nullable=False
    )
    revision_number: Mapped[int] = mapped_column(nullable=False)
    body: Mapped[str] = mapped_column(nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
