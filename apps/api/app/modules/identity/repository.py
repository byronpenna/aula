"""Acceso a datos del módulo identity. Sin lógica de negocio ni de autorización aquí
más allá del filtro por `school_id`/estado; eso vive en `service.py`."""

from __future__ import annotations

import uuid

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.modules.identity.models import (
    AuditEvent,
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


# --- Usuarios y roles (Fase 3) ---------------------------------------------


def get_user(db: Session, user_id: uuid.UUID) -> User | None:
    return db.get(User, user_id)


def get_membership(
    db: Session, school_id: uuid.UUID, user_id: uuid.UUID
) -> SchoolMembership | None:
    """A diferencia de `get_active_membership`, trae la membresía sin importar su
    estado (necesario para poder reactivarla)."""
    stmt = (
        select(SchoolMembership)
        .where(SchoolMembership.school_id == school_id, SchoolMembership.user_id == user_id)
        .options(joinedload(SchoolMembership.roles).joinedload(MembershipRole.role))
    )
    return db.execute(stmt).unique().scalar_one_or_none()


def list_users_for_school(
    db: Session,
    school_id: uuid.UUID,
    *,
    role: str | None = None,
    status: str | None = None,
    q: str | None = None,
) -> list[tuple[SchoolMembership, User, str | None]]:
    stmt = (
        select(SchoolMembership, User, LocalAuthCredential.username)
        .join(User, User.id == SchoolMembership.user_id)
        .outerjoin(LocalAuthCredential, LocalAuthCredential.user_id == User.id)
        .where(SchoolMembership.school_id == school_id)
        .options(joinedload(SchoolMembership.roles).joinedload(MembershipRole.role))
        .order_by(User.display_name)
    )
    if status:
        stmt = stmt.where(SchoolMembership.status == status)
    if q:
        pattern = f"%{q.strip().lower()}%"
        stmt = stmt.where(
            or_(func.lower(User.display_name).like(pattern), func.lower(User.email).like(pattern))
        )
    if role:
        stmt = stmt.where(
            SchoolMembership.id.in_(
                select(MembershipRole.membership_id)
                .join(Role, Role.id == MembershipRole.role_id)
                .where(Role.code == role)
            )
        )
    rows = db.execute(stmt).unique().all()
    return [(row[0], row[1], row[2]) for row in rows]


def count_active_holders_of_permission(
    db: Session, school_id: uuid.UUID, permission_code: str
) -> int:
    """Cuántas membresías activas del colegio tienen, por alguno de sus roles, el
    permiso dado — usado para no dejar la institución sin nadie que pueda
    administrar usuarios/roles."""
    stmt = (
        select(func.count(func.distinct(SchoolMembership.id)))
        .select_from(SchoolMembership)
        .join(MembershipRole, MembershipRole.membership_id == SchoolMembership.id)
        .join(RolePermission, RolePermission.role_id == MembershipRole.role_id)
        .join(Permission, Permission.id == RolePermission.permission_id)
        .where(
            SchoolMembership.school_id == school_id,
            SchoolMembership.status == "active",
            Permission.code == permission_code,
        )
    )
    return db.execute(stmt).scalar_one()


def get_membership_role(
    db: Session, membership_id: uuid.UUID, role_id: uuid.UUID
) -> MembershipRole | None:
    stmt = select(MembershipRole).where(
        MembershipRole.membership_id == membership_id, MembershipRole.role_id == role_id
    )
    return db.execute(stmt).scalar_one_or_none()


def list_permissions(db: Session) -> list[Permission]:
    return list(db.execute(select(Permission).order_by(Permission.code)).scalars().all())


def get_permissions_by_codes(db: Session, codes: list[str]) -> list[Permission]:
    if not codes:
        return []
    stmt = select(Permission).where(Permission.code.in_(codes))
    return list(db.execute(stmt).scalars().all())


def replace_role_permissions(
    db: Session, role_id: uuid.UUID, permission_ids: list[uuid.UUID]
) -> None:
    db.query(RolePermission).filter(RolePermission.role_id == role_id).delete()
    for permission_id in permission_ids:
        db.add(RolePermission(role_id=role_id, permission_id=permission_id))


def list_roles(db: Session) -> list[Role]:
    return list(db.execute(select(Role).order_by(Role.code)).scalars().all())


def count_active_members_with_role(db: Session, school_id: uuid.UUID, role_id: uuid.UUID) -> int:
    stmt = (
        select(func.count(func.distinct(SchoolMembership.id)))
        .join(MembershipRole, MembershipRole.membership_id == SchoolMembership.id)
        .where(
            SchoolMembership.school_id == school_id,
            SchoolMembership.status == "active",
            MembershipRole.role_id == role_id,
        )
    )
    return db.execute(stmt).scalar_one()


def list_members_with_role(
    db: Session, school_id: uuid.UUID, role_id: uuid.UUID
) -> list[tuple[SchoolMembership, User]]:
    stmt = (
        select(SchoolMembership, User)
        .join(User, User.id == SchoolMembership.user_id)
        .join(MembershipRole, MembershipRole.membership_id == SchoolMembership.id)
        .where(SchoolMembership.school_id == school_id, MembershipRole.role_id == role_id)
        .order_by(User.display_name)
    )
    return [(row[0], row[1]) for row in db.execute(stmt).all()]


def list_audit_events(
    db: Session, school_id: uuid.UUID, limit: int = 50
) -> list[tuple[AuditEvent, str | None]]:
    stmt = (
        select(AuditEvent, User.display_name)
        .outerjoin(User, User.id == AuditEvent.actor_id)
        .where(AuditEvent.school_id == school_id)
        .order_by(AuditEvent.occurred_at.desc())
        .limit(limit)
    )
    return [(row[0], row[1]) for row in db.execute(stmt).all()]
