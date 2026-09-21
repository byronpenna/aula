"""Seed idempotente de identidad demo contra la RDS de un ambiente cloud (sección 18).

Homólogo de `scripts/seed.py` para dev/staging: no crea `LocalAuthCredential` (en
cloud `LOCAL_AUTH_ENABLED=false`, la sesión se resuelve por `User.cognito_sub`
contra el `sub` real de Cognito, no por usuario/contraseña locales). Los usuarios
deben existir ya en el User Pool (creados aparte, p. ej. `admin-create-user`); esto
solo vincula `cognito_sub` + rol/colegio en la base de datos. Se invoca a mano
(`aws lambda invoke` sobre `MigrationRunnerFunction`, ver `app/ops/migration_runner.py`)
por un operador humano; no se expone por HTTP ni corre automáticamente.
"""

from __future__ import annotations

from typing import Any

from app.core.permissions import ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS
from app.db.session import SessionLocal
from app.modules.identity.models import (
    MembershipRole,
    Permission,
    Role,
    RolePermission,
    School,
    SchoolMembership,
    User,
)


def _get_or_create(db, model, defaults=None, **filters):
    instance = db.query(model).filter_by(**filters).one_or_none()
    if instance:
        return instance, False
    instance = model(**{**filters, **(defaults or {})})
    db.add(instance)
    db.flush()
    return instance, True


def _ensure_user(db, *, display_name, email, cognito_sub, role_code, school):
    user, _ = _get_or_create(
        db,
        User,
        cognito_sub=cognito_sub,
        defaults={"display_name": display_name, "email": email, "status": "active"},
    )
    membership, _ = _get_or_create(
        db, SchoolMembership, school_id=school.id, user_id=user.id, defaults={"status": "active"}
    )
    role = db.query(Role).filter_by(code=role_code).one()
    _get_or_create(db, MembershipRole, membership_id=membership.id, role_id=role.id)
    return user


def run(users: list[dict[str, Any]], school_name: str = "Colegio Demo") -> dict[str, Any]:
    """`users`: [{"display_name", "email" (opcional), "cognito_sub", "role_code"}, ...]"""
    db = SessionLocal()
    try:
        for code, description in ALL_PERMISSIONS.items():
            _get_or_create(db, Permission, code=code, defaults={"description": description})
        for role_code in DEFAULT_ROLE_PERMISSIONS:
            _get_or_create(
                db, Role, code=role_code, defaults={"name": role_code.replace("_", " ").title()}
            )
        db.flush()

        for role_code, perm_codes in DEFAULT_ROLE_PERMISSIONS.items():
            role = db.query(Role).filter_by(code=role_code).one()
            for perm_code in perm_codes:
                permission = db.query(Permission).filter_by(code=perm_code).one()
                _get_or_create(db, RolePermission, role_id=role.id, permission_id=permission.id)

        school, _ = _get_or_create(
            db,
            School,
            name=school_name,
            defaults={"timezone": "America/El_Salvador", "currency": "USD", "status": "active"},
        )
        db.flush()

        created = []
        for u in users:
            user = _ensure_user(
                db,
                display_name=u["display_name"],
                email=u.get("email"),
                cognito_sub=u["cognito_sub"],
                role_code=u["role_code"],
                school=school,
            )
            created.append({"user_id": str(user.id), "cognito_sub": user.cognito_sub})

        db.commit()
        return {"school_id": str(school.id), "users": created}
    finally:
        db.close()
