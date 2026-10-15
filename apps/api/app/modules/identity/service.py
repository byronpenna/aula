from __future__ import annotations

import secrets
import string
import uuid
from datetime import UTC, datetime

from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.deps import CurrentMembership
from app.core.errors import ConflictError, NotFoundError, UnauthorizedError, UnprocessableError
from app.core.permissions import ROLES_MANAGE, USERS_MANAGE
from app.core.security import issue_local_token
from app.modules.identity import cognito_admin
from app.modules.identity import mailer
from app.modules.identity import repository as identity_repo
from app.modules.identity.models import (
    AuditEvent,
    LocalAuthCredential,
    MembershipRole,
    Role,
    SchoolMembership,
    User,
)
from app.modules.identity.schemas import RolePermissionsUpdate, UserCreate

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Permisos que, si se le quitan al último titular activo, dejarían al colegio sin
# nadie que pueda administrar usuarios/roles (sección 6: "no dejar la institución
# sin administración").
_GUARDED_PERMISSIONS = (USERS_MANAGE, ROLES_MANAGE)


def hash_password(raw_password: str) -> str:
    return _pwd_context.hash(raw_password)


def generate_temp_password() -> str:
    """Cumple la política real del User Pool (infra/lib/identity-stack.ts:
    minLength 12, mayúscula+minúscula+dígito, símbolo no exigido). Se muestra en el
    formulario de alta, editable; se envía por correo solo si `mailer.mail_enabled`
    (ver `create_user`), nunca junto con la respuesta HTTP en ese caso."""
    alphabet = string.ascii_letters + string.digits
    while True:
        candidate = "".join(secrets.choice(alphabet) for _ in range(14))
        if (
            any(c.islower() for c in candidate)
            and any(c.isupper() for c in candidate)
            and any(c.isdigit() for c in candidate)
        ):
            return candidate


def local_login(db: Session, settings: Settings, username: str, password: str) -> str:
    """Adaptador de login local (sección 17): valida usuario/contraseña reales
    contra `local_auth_credentials`, no un bypass de header libre de rol."""
    if not settings.local_auth_enabled:
        raise UnauthorizedError("El login local está deshabilitado en este ambiente.")

    credential = identity_repo.get_local_credential(db, username)
    if credential is None or not _pwd_context.verify(password, credential.password_hash):
        raise UnauthorizedError("Usuario o contraseña incorrectos.")

    user = db.get(User, credential.user_id)
    if user is None or user.status != "active":
        raise UnauthorizedError("El usuario no existe o está inactivo.")

    return issue_local_token(settings, cognito_sub=user.cognito_sub or str(user.id))


def record_audit_event(
    db: Session,
    *,
    school_id: uuid.UUID | None,
    actor_id: uuid.UUID | None,
    action: str,
    target_type: str,
    target_id: str,
    changes: dict | None = None,
    request_id: str | None = None,
) -> None:
    """Inserta un evento de auditoría en la misma transacción que el cambio de
    negocio (no hace commit por su cuenta: el llamador controla la transacción)."""
    db.add(
        AuditEvent(
            school_id=school_id,
            actor_id=actor_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            changes=changes or {},
            request_id=request_id,
            occurred_at=datetime.now(UTC),
        )
    )


def create_user(
    db: Session,
    settings: Settings,
    current: CurrentMembership,
    payload: UserCreate,
    request_id: str | None,
) -> tuple[User, SchoolMembership, bool]:
    """Alta administrada (sección 6: "altas e invitaciones administradas", igual
    comentario en infra/lib/identity-stack.ts): fuera de APP_ENV=local crea la
    cuenta real en el User Pool de Cognito (`cognito_admin.admin_create_user`) y
    guarda el `sub` devuelto; en local crea la credencial de desarrollo. Nunca hay
    dos fuentes de verdad simultáneas para una misma cuenta.

    Devuelve también si se envió una invitación por correo (`mailer`, solo si hay
    `email` y `settings.mail_from_address` configurado) — el router usa ese valor
    para decidir si la contraseña va en la respuesta HTTP o no (sección 6: "la
    contraseña nunca viaja por dos canales a la vez")."""
    role = identity_repo.get_role_by_code(db, payload.role_code)
    if role is None:
        raise NotFoundError("El rol indicado no existe.")

    user = User(display_name=payload.display_name, email=payload.email, status="active")
    db.add(user)
    db.flush()

    if settings.local_auth_enabled:
        if identity_repo.get_local_credential(db, payload.username) is not None:
            raise ConflictError(f"Ya existe un usuario con el nombre '{payload.username}'.")
        db.add(
            LocalAuthCredential(
                user_id=user.id,
                username=payload.username,
                password_hash=hash_password(payload.password),
            )
        )
    else:
        user.cognito_sub = cognito_admin.admin_create_user(
            settings,
            username=payload.username,
            email=payload.email,
            temporary_password=payload.password,
        )

    membership = SchoolMembership(school_id=current.school_id, user_id=user.id, status="active")
    db.add(membership)
    db.flush()
    db.add(MembershipRole(membership_id=membership.id, role_id=role.id))

    record_audit_event(
        db,
        school_id=current.school_id,
        actor_id=current.membership.user_id,
        action="user.create",
        target_type="user",
        target_id=str(user.id),
        request_id=request_id,
    )
    db.commit()
    db.refresh(user)
    db.refresh(membership)

    invitation_sent = False
    if payload.email and mailer.mail_enabled(settings):
        invitation_sent = mailer.send_invitation_email(
            settings,
            to_email=payload.email,
            display_name=payload.display_name,
            username=payload.username,
            temporary_password=payload.password,
        )

    return user, membership, invitation_sent


def _require_membership(
    db: Session, current: CurrentMembership, target_user_id: uuid.UUID
) -> SchoolMembership:
    membership = identity_repo.get_membership(db, current.school_id, target_user_id)
    if membership is None:
        raise NotFoundError("El usuario indicado no existe en este colegio.")
    return membership


def _guard_last_admin(
    db: Session, current: CurrentMembership, membership: SchoolMembership, role_ids: list[uuid.UUID]
) -> None:
    """Antes de desactivar una membresía o revocarle un rol, confirma que ningún
    permiso administrativo se quede sin ningún titular activo (sección 6/5:
    "no permitir... que se desactive al último administrador")."""
    if membership.status != "active" or not role_ids:
        return
    permission_codes = identity_repo.get_permission_codes_for_roles(db, role_ids)
    for permission_code in _GUARDED_PERMISSIONS:
        if permission_code not in permission_codes:
            continue
        if identity_repo.count_active_holders_of_permission(
            db, current.school_id, permission_code
        ) <= 1:
            raise ConflictError(
                "Esta acción dejaría al colegio sin nadie con permiso para administrar "
                f"usuarios/roles ('{permission_code}'); asigna ese permiso a otra persona primero."
            )


def set_membership_status(
    db: Session,
    current: CurrentMembership,
    target_user_id: uuid.UUID,
    status: str,
    request_id: str | None,
) -> SchoolMembership:
    membership = _require_membership(db, current, target_user_id)
    if status == "inactive":
        role_ids = [mr.role_id for mr in membership.roles]
        _guard_last_admin(db, current, membership, role_ids)
    if membership.status != status:
        membership.status = status
        record_audit_event(
            db,
            school_id=current.school_id,
            actor_id=current.membership.user_id,
            action=f"membership.{status}",
            target_type="school_membership",
            target_id=str(membership.id),
            request_id=request_id,
        )
        db.commit()
        db.refresh(membership)
    return membership


def assign_role(
    db: Session,
    current: CurrentMembership,
    target_user_id: uuid.UUID,
    role_code: str,
    request_id: str | None,
) -> SchoolMembership:
    membership = _require_membership(db, current, target_user_id)
    role = identity_repo.get_role_by_code(db, role_code)
    if role is None:
        raise NotFoundError("El rol indicado no existe.")

    if identity_repo.get_membership_role(db, membership.id, role.id) is None:
        db.add(MembershipRole(membership_id=membership.id, role_id=role.id))
        record_audit_event(
            db,
            school_id=current.school_id,
            actor_id=current.membership.user_id,
            action="membership.assign_role",
            target_type="school_membership",
            target_id=str(membership.id),
            changes={"role_code": role_code},
            request_id=request_id,
        )
        db.commit()
        db.refresh(membership)
    return membership


def revoke_role(
    db: Session,
    current: CurrentMembership,
    target_user_id: uuid.UUID,
    role_code: str,
    request_id: str | None,
) -> SchoolMembership:
    membership = _require_membership(db, current, target_user_id)
    role = identity_repo.get_role_by_code(db, role_code)
    if role is None:
        raise NotFoundError("El rol indicado no existe.")
    membership_role = identity_repo.get_membership_role(db, membership.id, role.id)
    if membership_role is None:
        raise NotFoundError("El usuario no tiene ese rol asignado.")

    _guard_last_admin(db, current, membership, [role.id])
    db.delete(membership_role)
    record_audit_event(
        db,
        school_id=current.school_id,
        actor_id=current.membership.user_id,
        action="membership.revoke_role",
        target_type="school_membership",
        target_id=str(membership.id),
        changes={"role_code": role_code},
        request_id=request_id,
    )
    db.commit()
    db.refresh(membership)
    return membership


def update_role_permissions(
    db: Session,
    current: CurrentMembership,
    role_code: str,
    payload: RolePermissionsUpdate,
    request_id: str | None,
) -> Role:
    role = identity_repo.get_role_by_code(db, role_code)
    if role is None:
        raise NotFoundError("El rol indicado no existe.")
    if role.version != payload.expected_version:
        raise ConflictError(
            "El rol fue actualizado por otro administrador; recarga e intenta de nuevo."
        )

    requested_codes = set(payload.permission_codes)
    if role.code == "school_admin" and not set(_GUARDED_PERMISSIONS).issubset(requested_codes):
        raise UnprocessableError(
            "No puedes quitar la administración de usuarios/roles al rol school_admin; "
            "dejaría al colegio sin nadie que pueda revertirlo."
        )

    permissions = identity_repo.get_permissions_by_codes(db, list(requested_codes))
    found_codes = {p.code for p in permissions}
    unknown = requested_codes - found_codes
    if unknown:
        raise UnprocessableError(f"Permisos desconocidos: {', '.join(sorted(unknown))}.")

    identity_repo.replace_role_permissions(db, role.id, [p.id for p in permissions])
    role.version += 1
    record_audit_event(
        db,
        school_id=current.school_id,
        actor_id=current.membership.user_id,
        action="role.update_permissions",
        target_type="role",
        target_id=str(role.id),
        changes={"permission_codes": sorted(found_codes)},
        request_id=request_id,
    )
    db.commit()
    db.refresh(role)
    return role


def list_linked_students(db: Session, guardian_user_id: uuid.UUID) -> list[dict]:
    links = identity_repo.get_active_guardian_links(db, guardian_user_id)
    results = []
    for link in links:
        profile = identity_repo.get_student_profile(db, link.student_id)
        if profile is None:
            continue
        student_user = db.get(User, profile.user_id) if profile.user_id else None
        results.append(
            {
                "student_id": profile.id,
                "school_id": profile.school_id,
                "student_number": profile.student_number,
                "display_name": student_user.display_name if student_user else None,
                "relationship_label": link.relationship_label,
            }
        )
    return results
