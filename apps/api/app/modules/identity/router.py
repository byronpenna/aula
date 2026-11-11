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
    COURSE_READ,
    ENROLLMENT_MANAGE,
    GUARDIAN_LINK_MANAGE,
    ROLES_MANAGE,
    USERS_MANAGE,
)
from app.db.session import get_db
from app.modules.identity import repository as identity_repo
from app.modules.identity import service as identity_service
from app.modules.identity.models import Role, SchoolMembership, StudentProfile, User
from app.modules.identity.schemas import (
    AuditEventOut,
    GuardianLinkCreate,
    GuardianLinkOut,
    GuardianProfileCreate,
    GuardianProfileOut,
    GuardianProfileUpdate,
    LinkedStudentOut,
    LocalLoginRequest,
    LocalLoginResponse,
    MembershipOut,
    MeOut,
    MeUpdate,
    PermissionOut,
    PermissionsOut,
    RoleAssignmentCreate,
    RoleOut,
    RolePermissionsUpdate,
    RoleUserOut,
    StudentProfileCreate,
    StudentProfileOut,
    StudentProfileUpdate,
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
        handle=user.handle,
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
        handle=user.handle,
        status=user.status,
        memberships=out_memberships,
    )


@router.patch("/me", response_model=MeOut)
def update_me(
    payload: MeUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> MeOut:
    """Autoservicio: cualquier usuario autenticado, sin importar su rol, puede
    establecer su propio `@handle` tageable (sección 6 no define un flujo para
    esto porque antes no existía; vive aquí, no en `PATCH /users/{id}`, porque no
    requiere USERS_MANAGE)."""
    identity_service.update_my_handle(db, user, payload.handle)
    return read_me(user=user, db=db)


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


def _student_profile_out(
    profile: StudentProfile, linked_user_display_name: str | None
) -> StudentProfileOut:
    return StudentProfileOut(
        id=profile.id,
        student_number=profile.student_number,
        display_name=identity_service.student_display_name(profile, linked_user_display_name),
        first_name=profile.first_name,
        last_name=profile.last_name,
        birth_date=profile.birth_date,
        photo_file_id=profile.photo_file_id,
        user_id=profile.user_id,
    )


@router.get("/students", response_model=list[StudentProfileOut])
def list_students(
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(ENROLLMENT_MANAGE)),
) -> list[StudentProfileOut]:
    rows = identity_repo.list_student_profiles(db, current.school_id)
    return [_student_profile_out(profile, name) for profile, name in rows]


def _linked_user_display_name(db: Session, profile: StudentProfile) -> str | None:
    if profile.user_id is None:
        return None
    user = identity_repo.get_user(db, profile.user_id)
    return user.display_name if user else None


@router.post("/students", response_model=StudentProfileOut)
def create_student(
    payload: StudentProfileCreate,
    request: Request,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(ENROLLMENT_MANAGE)),
) -> StudentProfileOut:
    profile = identity_service.create_student_profile(
        db, current, payload, request.state.request_id
    )
    return _student_profile_out(profile, _linked_user_display_name(db, profile))


@router.patch("/students/{student_id}", response_model=StudentProfileOut)
def update_student(
    student_id: uuid.UUID,
    payload: StudentProfileUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(ENROLLMENT_MANAGE)),
) -> StudentProfileOut:
    profile = identity_service.update_student_profile(
        db, current, student_id, payload, request.state.request_id
    )
    return _student_profile_out(profile, _linked_user_display_name(db, profile))


@router.get("/students/{student_id}/guardians", response_model=list[GuardianLinkOut])
def list_student_guardians(
    student_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    current: CurrentMembership = Depends(require_permission(COURSE_READ)),
) -> list[GuardianLinkOut]:
    rows = identity_service.list_guardian_links(db, current, user.id, student_id)
    return [
        GuardianLinkOut(
            id=link.id,
            guardian_id=link.guardian_id,
            guardian_display_name=name,
            guardian_phone=phone,
            student_id=link.student_id,
            relationship_label=link.relationship_label,
            status=link.status,
            valid_from=link.valid_from,
            valid_to=link.valid_to,
        )
        for link, name, phone in rows
    ]


@router.post("/students/{student_id}/guardians", response_model=GuardianLinkOut)
def create_student_guardian(
    student_id: uuid.UUID,
    payload: GuardianLinkCreate,
    request: Request,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(GUARDIAN_LINK_MANAGE)),
) -> GuardianLinkOut:
    link = identity_service.create_guardian_link(
        db, current, student_id, payload, request.state.request_id
    )
    guardian = identity_repo.get_guardian_profile(db, current.school_id, link.guardian_id)
    return GuardianLinkOut(
        id=link.id,
        guardian_id=link.guardian_id,
        guardian_display_name=guardian.full_name if guardian else None,
        guardian_phone=guardian.phone if guardian else None,
        student_id=link.student_id,
        relationship_label=link.relationship_label,
        status=link.status,
        valid_from=link.valid_from,
        valid_to=link.valid_to,
    )


@router.delete("/students/{student_id}/guardians/{link_id}", response_model=GuardianLinkOut)
def revoke_student_guardian(
    student_id: uuid.UUID,
    link_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(GUARDIAN_LINK_MANAGE)),
) -> GuardianLinkOut:
    link = identity_service.revoke_guardian_link(
        db, current, student_id, link_id, request.state.request_id
    )
    guardian = identity_repo.get_guardian_profile(db, current.school_id, link.guardian_id)
    return GuardianLinkOut(
        id=link.id,
        guardian_id=link.guardian_id,
        guardian_display_name=guardian.full_name if guardian else None,
        guardian_phone=guardian.phone if guardian else None,
        student_id=link.student_id,
        relationship_label=link.relationship_label,
        status=link.status,
        valid_from=link.valid_from,
        valid_to=link.valid_to,
    )


@router.get("/guardians", response_model=list[GuardianProfileOut])
def list_guardians(
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(GUARDIAN_LINK_MANAGE)),
) -> list[GuardianProfileOut]:
    return [
        GuardianProfileOut(**data)
        for data in identity_service.list_guardian_profiles_with_students(db, current)
    ]


@router.post("/guardians", response_model=GuardianProfileOut)
def create_guardian(
    payload: GuardianProfileCreate,
    request: Request,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(GUARDIAN_LINK_MANAGE)),
) -> GuardianProfileOut:
    data = identity_service.create_guardian_profile(db, current, payload, request.state.request_id)
    return GuardianProfileOut(**data)


@router.get("/guardians/{guardian_id}", response_model=GuardianProfileOut)
def get_guardian(
    guardian_id: uuid.UUID,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(GUARDIAN_LINK_MANAGE)),
) -> GuardianProfileOut:
    data = identity_service.get_guardian_profile_detail(db, current, guardian_id)
    return GuardianProfileOut(**data)


@router.patch("/guardians/{guardian_id}", response_model=GuardianProfileOut)
def update_guardian(
    guardian_id: uuid.UUID,
    payload: GuardianProfileUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(GUARDIAN_LINK_MANAGE)),
) -> GuardianProfileOut:
    data = identity_service.update_guardian_profile(
        db, current, guardian_id, payload, request.state.request_id
    )
    return GuardianProfileOut(**data)


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
    endpoints de /role-assignments de abajo. También permite fijar el `@handle` de
    este usuario en su nombre (ver `identity_service.update_user`)."""
    user = _require_user(db, current, user_id)
    return identity_service.update_user(db, user, payload)


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
