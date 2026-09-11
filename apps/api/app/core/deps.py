"""Dependencias explícitas de FastAPI para sesión DB, usuario actual, colegio
efectivo y autorización (sección 4 y 6 del documento de arquitectura).

Regla universal: verificar colegio + permiso + vínculo con el recurso (sección 6).
El `school_id` efectivo se deriva de la membresía ACTIVA autenticada; un `school_id`
recibido por query/path es solo un candidato que se valida contra esa membresía, nunca
se confía en él sin esa validación.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass

from fastapi import Depends, Header, Query, Request
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.errors import ForbiddenError, UnauthorizedError
from app.core.security import TokenClaims, verify_access_token
from app.db.session import get_db
from app.modules.identity import repository as identity_repo
from app.modules.identity.models import SchoolMembership, User


def get_current_claims(request: Request, settings: Settings = Depends(get_settings)) -> TokenClaims:
    auth_header = request.headers.get("authorization", "")
    if not auth_header.lower().startswith("bearer "):
        raise UnauthorizedError("Falta el header Authorization: Bearer <token>.")
    token = auth_header.split(" ", 1)[1].strip()
    return verify_access_token(token, settings)


def get_current_user(
    claims: TokenClaims = Depends(get_current_claims),
    db: Session = Depends(get_db),
) -> User:
    """Autorización y estado activo se consultan en DB en cada solicitud (sección 6):
    revocar el usuario debe surtir efecto aunque el access token siga vigente."""
    user = identity_repo.get_user_by_cognito_sub(db, claims.sub)
    if user is None or user.status != "active":
        raise UnauthorizedError("El usuario no existe o está inactivo.")
    return user


@dataclass(frozen=True)
class CurrentMembership:
    membership: SchoolMembership
    school_id: uuid.UUID
    role_codes: frozenset[str]
    permission_codes: frozenset[str]


def get_current_membership(
    school_id: uuid.UUID | None = Query(
        default=None,
        description="Colegio objetivo cuando el usuario tiene más de una membresía activa.",
    ),
    x_school_id: uuid.UUID | None = Header(default=None, alias="X-School-Id"),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CurrentMembership:
    candidate = school_id or x_school_id
    memberships = identity_repo.get_memberships_for_user(db, user.id)
    active = [m for m in memberships if m.status == "active"]

    if candidate is not None:
        membership = next((m for m in active if m.school_id == candidate), None)
        if membership is None:
            # 404, no 403: no revelamos si el colegio existe cuando el usuario no
            # tiene vínculo con él (sección 6: responder 404 para ocultar existencia).
            raise ForbiddenError("No tienes una membresía activa en ese colegio.")
    elif len(active) == 1:
        membership = active[0]
    elif len(active) == 0:
        raise ForbiddenError("El usuario no tiene ninguna membresía activa.")
    else:
        raise ForbiddenError(
            "El usuario tiene varias membresías activas; especifica school_id."
        )

    role_ids = [mr.role_id for mr in membership.roles]
    role_codes = frozenset(mr.role.code for mr in membership.roles)
    permission_codes = frozenset(identity_repo.get_permission_codes_for_roles(db, role_ids))
    return CurrentMembership(
        membership=membership,
        school_id=membership.school_id,
        role_codes=role_codes,
        permission_codes=permission_codes,
    )


def require_permission(permission_code: str):
    def _dependency(
        current: CurrentMembership = Depends(get_current_membership),
    ) -> CurrentMembership:
        if permission_code not in current.permission_codes:
            raise ForbiddenError(f"Falta el permiso '{permission_code}'.")
        return current

    return _dependency
