from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, SchoolScopedMixin, TimestampMixin, UUIDPKMixin


class School(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "schools"

    name: Mapped[str] = mapped_column(nullable=False)
    timezone: Mapped[str] = mapped_column(nullable=False, default="America/El_Salvador")
    currency: Mapped[str] = mapped_column(nullable=False, default="USD")
    status: Mapped[str] = mapped_column(nullable=False, default="active")


class User(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "users"

    # Nullable mientras el usuario está en estado de invitación sin primer login.
    cognito_sub: Mapped[str | None] = mapped_column(unique=True, nullable=True)
    display_name: Mapped[str] = mapped_column(nullable=False)
    email: Mapped[str | None] = mapped_column(nullable=True)
    status: Mapped[str] = mapped_column(nullable=False, default="invited")


class LocalAuthCredential(UUIDPKMixin, TimestampMixin, Base):
    """Credencial de desarrollo local únicamente. Nunca se usa fuera de APP_ENV=local
    (ver `core/security.py` y `core/config.py::_guard_local_auth`). No sustituye a
    Cognito; existe solo para poder iniciar sesión real (no un bypass de header) en
    el entorno local reproducible (sección 17)."""

    __tablename__ = "local_auth_credentials"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), unique=True, nullable=False
    )
    username: Mapped[str] = mapped_column(unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(nullable=False)


class SchoolMembership(UUIDPKMixin, TimestampMixin, SchoolScopedMixin, Base):
    __tablename__ = "school_memberships"
    __table_args__ = (UniqueConstraint("school_id", "user_id", name="uq_membership_school_user"),)

    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(nullable=False, default="active")

    roles: Mapped[list[MembershipRole]] = relationship(
        back_populates="membership", cascade="all, delete-orphan"
    )


class Role(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "roles"

    code: Mapped[str] = mapped_column(unique=True, nullable=False)
    name: Mapped[str] = mapped_column(nullable=False)


class Permission(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "permissions"

    code: Mapped[str] = mapped_column(unique=True, nullable=False)
    description: Mapped[str] = mapped_column(nullable=False)


class RolePermission(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "role_permissions"
    __table_args__ = (UniqueConstraint("role_id", "permission_id", name="uq_role_permission"),)

    role_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("roles.id"))
    permission_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("permissions.id")
    )


class MembershipRole(UUIDPKMixin, TimestampMixin, Base):
    __tablename__ = "membership_roles"
    __table_args__ = (
        UniqueConstraint("membership_id", "role_id", name="uq_membership_role"),
    )

    membership_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("school_memberships.id")
    )
    role_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("roles.id"))

    membership: Mapped[SchoolMembership] = relationship(back_populates="roles")
    role: Mapped[Role] = relationship()


class StudentProfile(UUIDPKMixin, TimestampMixin, SchoolScopedMixin, Base):
    __tablename__ = "student_profiles"
    __table_args__ = (
        UniqueConstraint("school_id", "student_number", name="uq_student_number_per_school"),
    )

    # Nullable: un alumno puede existir en el sistema académico antes de tener cuenta.
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    student_number: Mapped[str] = mapped_column(nullable=False)


class GuardianStudentLink(UUIDPKMixin, TimestampMixin, SchoolScopedMixin, Base):
    __tablename__ = "guardian_student_links"

    guardian_user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id"))
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("student_profiles.id")
    )
    relationship_label: Mapped[str] = mapped_column(nullable=False, default="guardian")
    status: Mapped[str] = mapped_column(nullable=False, default="active")
    valid_from: Mapped[date] = mapped_column(nullable=False)
    valid_to: Mapped[date | None] = mapped_column(nullable=True)


class AuditEvent(UUIDPKMixin, Base):
    """Rol de aplicación puede insertar auditoría pero no actualizarla/borrarla
    (sección 11); no se define UPDATE/DELETE en el repositorio de este módulo."""

    __tablename__ = "audit_events"

    school_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("schools.id"), nullable=True, index=True
    )
    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    action: Mapped[str] = mapped_column(nullable=False)
    target_type: Mapped[str] = mapped_column(nullable=False)
    target_id: Mapped[str] = mapped_column(nullable=False)
    request_id: Mapped[str | None] = mapped_column(nullable=True)
    changes: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    occurred_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
