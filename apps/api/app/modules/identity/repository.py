"""Acceso a datos del módulo identity. Sin lógica de negocio ni de autorización aquí
más allá del filtro por `school_id`/estado; eso vive en `service.py`."""

from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.modules.identity.models import (
    GuardianStudentLink,
    LocalAuthCredential,
    MembershipRole,
    Permission,
    Role,
    RolePermission,
    School,
    SchoolMembership,
    StudentProfile,
    User,
)


def list_users_with_role(db: Session, school_id: uuid.UUID, role_code: str) -> list[User]:
    """Miembros activos del colegio con un rol dado (p. ej. docentes disponibles para
    asignar a un curso, sección 6/9)."""
    stmt = (
        select(User)
        .join(SchoolMembership, SchoolMembership.user_id == User.id)
        .join(MembershipRole, MembershipRole.membership_id == SchoolMembership.id)
        .join(Role, Role.id == MembershipRole.role_id)
        .where(
            SchoolMembership.school_id == school_id,
            SchoolMembership.status == "active",
            Role.code == role_code,
        )
        .order_by(User.display_name)
    )
    return list(db.execute(stmt).unique().scalars().all())


def get_user_by_cognito_sub(db: Session, cognito_sub: str) -> User | None:
    stmt = select(User).where(User.cognito_sub == cognito_sub)
    return db.execute(stmt).scalar_one_or_none()


def get_local_credential(db: Session, username: str) -> LocalAuthCredential | None:
    stmt = select(LocalAuthCredential).where(LocalAuthCredential.username == username)
    return db.execute(stmt).scalar_one_or_none()


def get_memberships_for_user(db: Session, user_id: uuid.UUID) -> list[SchoolMembership]:
    stmt = (
        select(SchoolMembership)
        .where(SchoolMembership.user_id == user_id)
        .options(joinedload(SchoolMembership.roles).joinedload(MembershipRole.role))
    )
    return list(db.execute(stmt).unique().scalars().all())


def get_active_membership(
    db: Session, user_id: uuid.UUID, school_id: uuid.UUID
) -> SchoolMembership | None:
    stmt = (
        select(SchoolMembership)
        .where(
            SchoolMembership.user_id == user_id,
            SchoolMembership.school_id == school_id,
            SchoolMembership.status == "active",
        )
        .options(joinedload(SchoolMembership.roles).joinedload(MembershipRole.role))
    )
    return db.execute(stmt).unique().scalar_one_or_none()


def get_school(db: Session, school_id: uuid.UUID) -> School | None:
    return db.get(School, school_id)


def get_permission_codes_for_roles(db: Session, role_ids: list[uuid.UUID]) -> set[str]:
    if not role_ids:
        return set()
    stmt = (
        select(Permission.code)
        .join(RolePermission, RolePermission.permission_id == Permission.id)
        .where(RolePermission.role_id.in_(role_ids))
    )
    return set(db.execute(stmt).scalars().all())


def get_role_by_code(db: Session, code: str) -> Role | None:
    stmt = select(Role).where(Role.code == code)
    return db.execute(stmt).scalar_one_or_none()


def get_active_guardian_links(
    db: Session, guardian_user_id: uuid.UUID
) -> list[GuardianStudentLink]:
    stmt = select(GuardianStudentLink).where(
        GuardianStudentLink.guardian_user_id == guardian_user_id,
        GuardianStudentLink.status == "active",
    )
    return list(db.execute(stmt).scalars().all())


def get_student_profile(db: Session, student_id: uuid.UUID) -> StudentProfile | None:
    return db.get(StudentProfile, student_id)


def get_student_profile_by_user(
    db: Session, school_id: uuid.UUID, user_id: uuid.UUID
) -> StudentProfile | None:
    stmt = select(StudentProfile).where(
        StudentProfile.school_id == school_id, StudentProfile.user_id == user_id
    )
    return db.execute(stmt).scalar_one_or_none()


def list_student_profiles(
    db: Session, school_id: uuid.UUID
) -> list[tuple[StudentProfile, str | None]]:
    """Cada fila trae el `display_name` del `User` vinculado (puede ser `None`: un
    alumno puede existir en el sistema académico antes de tener cuenta, ver
    `StudentProfile.user_id`)."""
    stmt = (
        select(StudentProfile, User.display_name)
        .outerjoin(User, User.id == StudentProfile.user_id)
        .where(StudentProfile.school_id == school_id)
        .order_by(StudentProfile.student_number)
    )
    return [(row[0], row[1]) for row in db.execute(stmt).all()]
