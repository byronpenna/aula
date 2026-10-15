from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.deps import (
    CurrentMembership,
    get_current_membership,
    get_current_user,
    require_permission,
)
from app.core.errors import NotFoundError
from app.core.permissions import (
    ACADEMICS_MANAGE,
    AUDIT_READ,
    ENROLLMENT_MANAGE,
    ROLES_MANAGE,
    USERS_MANAGE,
)
from app.db.session import get_db
from app.modules.identity import repository as identity_repo
from app.modules.identity import service as identity_service
from app.modules.identity.models import Role, SchoolMembership, User
from app.modules.identity.schemas import (
    AuditEventOut,
    LinkedStudentOut,
    LocalLoginRequest,
    LocalLoginResponse,
    MembershipOut,
    MeOut,
    PermissionOut,
    PermissionsOut,
    RoleAssignmentCreate,
    RoleOut,
    RolePermissionsUpdate,
    RoleUserOut,
    StudentProfileOut,
    UserCreate,
    UserCreateOut,
    UserListItemOut,
    UserOut,
    UserUpdate,
)

router = APIRouter(tags=["identity"])


def _user_list_item_out(
    membership: SchoolMembership, user: User, username: str | None
) -> UserListItemOut:
    return UserListItemOut(
        id=user.id,
        display_name=user.display_name,
        email=user.email,
        username=username,
        membership_status=membership.status,
        role_codes=[mr.role.code for mr in membership.roles],
    )


def _role_out(db: Session, current: CurrentMembership, role: Role) -> RoleOut:
    permission_codes = sorted(identity_repo.get_permission_codes_for_roles(db, [role.id]))
    assigned = identity_repo.count_active_members_with_role(db, current.school_id, role.id)
    return RoleOut(
        code=role.code,
        name=role.name,
        is_system=role.is_system,
        version=role.version,
        permission_codes=permission_codes,
        assigned_user_count=assigned,
    )


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


@router.get("/students", response_model=list[StudentProfileOut])
def list_students(
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(ENROLLMENT_MANAGE)),
) -> list[StudentProfileOut]:
    rows = identity_repo.list_student_profiles(db, current.school_id)
    return [
        StudentProfileOut(id=profile.id, student_number=profile.student_number, display_name=name)
        for profile, name in rows
    ]


@router.get("/teachers", response_model=list[UserOut])
def list_teachers(
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(ACADEMICS_MANAGE)),
) -> list[User]:
    """Docentes con membresía activa en el colegio, para el selector de "docente
    encargado" al asignar un curso (sección 9)."""
    return identity_repo.list_users_with_role(db, current.school_id, "teacher")


@router.get("/users", response_model=list[UserListItemOut])
def list_users(
    role: str | None = None,
    status: str | None = None,
    q: str | None = None,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(USERS_MANAGE)),
) -> list[UserListItemOut]:
    rows = identity_repo.list_users_for_school(db, current.school_id, role=role, status=status, q=q)
    return [_user_list_item_out(membership, user, username) for membership, user, username in rows]


@router.post("/users", response_model=UserCreateOut)
def create_user(
    payload: UserCreate,
    request: Request,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current: CurrentMembership = Depends(require_permission(USERS_MANAGE)),
) -> UserCreateOut:
    user, membership, invitation_sent = identity_service.create_user(
        db, settings, current, payload, request.state.request_id
    )
    base = _user_list_item_out(membership, user, payload.username)
    return UserCreateOut(
        **base.model_dump(),
        invitation_sent=invitation_sent,
        temporary_password=None if invitation_sent else payload.password,
    )


def _require_user(db: Session, current: CurrentMembership, user_id: uuid.UUID) -> User:
    if identity_repo.get_membership(db, current.school_id, user_id) is None:
        raise NotFoundError("El usuario indicado no existe en este colegio.")
    user = identity_repo.get_user(db, user_id)
    if user is None:
        raise NotFoundError("El usuario indicado no existe en este colegio.")
    return user


@router.patch("/users/{user_id}", response_model=UserOut)
def update_user(
    user_id: uuid.UUID,
    payload: UserUpdate,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(USERS_MANAGE)),
) -> User:
    """Nunca acepta roles aquí (sección 4 de 04-MODELO-DATOS-Y-API.md: "no permitir
    modificar roles/alcances en un PATCH /users/{id} genérico") — eso vive en los
    endpoints de /role-assignments de abajo."""
    user = _require_user(db, current, user_id)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


@router.post("/users/{user_id}/activate", response_model=UserListItemOut)
def activate_user(
    user_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(USERS_MANAGE)),
) -> UserListItemOut:
    membership = identity_service.set_membership_status(
        db, current, user_id, "active", request.state.request_id
    )
    user = _require_user(db, current, user_id)
    return _user_list_item_out(membership, user, None)


@router.post("/users/{user_id}/deactivate", response_model=UserListItemOut)
def deactivate_user(
    user_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(USERS_MANAGE)),
) -> UserListItemOut:
    membership = identity_service.set_membership_status(
        db, current, user_id, "inactive", request.state.request_id
    )
    user = _require_user(db, current, user_id)
    return _user_list_item_out(membership, user, None)


@router.post("/users/{user_id}/role-assignments", response_model=UserListItemOut)
def assign_user_role(
    user_id: uuid.UUID,
    payload: RoleAssignmentCreate,
    request: Request,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(USERS_MANAGE)),
) -> UserListItemOut:
    membership = identity_service.assign_role(
        db, current, user_id, payload.role_code, request.state.request_id
    )
    user = _require_user(db, current, user_id)
    return _user_list_item_out(membership, user, None)


@router.delete("/users/{user_id}/role-assignments/{role_code}", response_model=UserListItemOut)
def revoke_user_role(
    user_id: uuid.UUID,
    role_code: str,
    request: Request,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(USERS_MANAGE)),
) -> UserListItemOut:
    membership = identity_service.revoke_role(
        db, current, user_id, role_code, request.state.request_id
    )
    user = _require_user(db, current, user_id)
    return _user_list_item_out(membership, user, None)


@router.get("/permissions", response_model=list[PermissionOut])
def list_permissions(
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(ROLES_MANAGE)),
) -> list[PermissionOut]:
    permissions = identity_repo.list_permissions(db)
    return [PermissionOut.model_validate(p) for p in permissions]


@router.get("/roles", response_model=list[RoleOut])
def list_roles(
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(ROLES_MANAGE)),
) -> list[RoleOut]:
    return [_role_out(db, current, role) for role in identity_repo.list_roles(db)]


@router.get("/roles/{role_code}", response_model=RoleOut)
def get_role(
    role_code: str,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(ROLES_MANAGE)),
) -> RoleOut:
    role = identity_repo.get_role_by_code(db, role_code)
    if role is None:
        raise NotFoundError("El rol indicado no existe.")
    return _role_out(db, current, role)


@router.get("/roles/{role_code}/users", response_model=list[RoleUserOut])
def list_role_users(
    role_code: str,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(ROLES_MANAGE)),
) -> list[RoleUserOut]:
    role = identity_repo.get_role_by_code(db, role_code)
    if role is None:
        raise NotFoundError("El rol indicado no existe.")
    rows = identity_repo.list_members_with_role(db, current.school_id, role.id)
    return [
        RoleUserOut(
            id=user.id, display_name=user.display_name, email=user.email,
            membership_status=membership.status,
        )
        for membership, user in rows
    ]


@router.put("/roles/{role_code}/permissions", response_model=RoleOut)
def update_role_permissions(
    role_code: str,
    payload: RolePermissionsUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(ROLES_MANAGE)),
) -> RoleOut:
    role = identity_service.update_role_permissions(
        db, current, role_code, payload, request.state.request_id
    )
    return _role_out(db, current, role)


@router.get("/audit-logs", response_model=list[AuditEventOut])
def list_audit_logs(
    limit: int = 50,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(AUDIT_READ)),
) -> list[AuditEventOut]:
    rows = identity_repo.list_audit_events(db, current.school_id, limit=min(limit, 200))
    return [
        AuditEventOut(
            id=event.id,
            actor_id=event.actor_id,
            actor_display_name=actor_name,
            action=event.action,
            target_type=event.target_type,
            target_id=event.target_id,
            occurred_at=event.occurred_at,
            request_id=event.request_id,
        )
        for event, actor_name in rows
    ]


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
