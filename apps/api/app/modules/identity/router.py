from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.deps import CurrentMembership, get_current_membership, get_current_user
from app.db.session import get_db
from app.modules.identity import repository as identity_repo
from app.modules.identity import service as identity_service
from app.modules.identity.models import User
from app.modules.identity.schemas import (
    LinkedStudentOut,
    LocalLoginRequest,
    LocalLoginResponse,
    MembershipOut,
    MeOut,
    PermissionsOut,
)

router = APIRouter(tags=["identity"])


@router.get("/me", response_model=MeOut)
def read_me(user: User = Depends(get_current_user), db: Session = Depends(get_db)) -> MeOut:
    memberships = identity_repo.get_memberships_for_user(db, user.id)
    out_memberships = []
    for m in memberships:
        school = identity_repo.get_school(db, m.school_id)
        out_memberships.append(
            MembershipOut(
                school_id=m.school_id,
                school_name=school.name if school else "",
                status=m.status,
                roles=[mr.role.code for mr in m.roles],
            )
        )
    return MeOut(
        id=user.id,
        display_name=user.display_name,
        email=user.email,
        status=user.status,
        memberships=out_memberships,
    )


@router.get("/me/permissions", response_model=PermissionsOut)
def read_my_permissions(
    current: CurrentMembership = Depends(get_current_membership),
) -> PermissionsOut:
    return PermissionsOut(
        school_id=current.school_id, permissions=sorted(current.permission_codes)
    )


@router.get("/me/students", response_model=list[LinkedStudentOut])
def read_my_students(
    user: User = Depends(get_current_user), db: Session = Depends(get_db)
) -> list[dict]:
    """Tutor: selector de hijos vinculados; nunca búsqueda libre de otros alumnos
    (sección 10). Solo vínculos con status=active (sección 19, punto 2)."""
    return identity_service.list_linked_students(db, user.id)


@router.post("/auth/local/token", response_model=LocalLoginResponse)
def local_login(
    payload: LocalLoginRequest,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
) -> LocalLoginResponse:
    """Adaptador de autenticación solo para APP_ENV=local (sección 17). La ruta queda
    montada en todo ambiente por simplicidad, pero `Settings` se niega a arrancar si
    `local_auth_enabled=true` fuera de `APP_ENV=local` (`core/config.py::_guard_local_auth`);
    con la app arrancada correctamente en dev/staging/prod, `local_auth_enabled` es
    `false` y este endpoint siempre responde 401."""
    token = identity_service.local_login(db, settings, payload.username, payload.password)
    return LocalLoginResponse(access_token=token, expires_in=settings.local_jwt_ttl_seconds)
