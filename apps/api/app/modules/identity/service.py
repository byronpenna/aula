from __future__ import annotations

import re
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
from app.modules.academics import repository as academics_repo
from app.modules.identity import cognito_admin, mailer
from app.modules.identity import repository as identity_repo
from app.modules.identity.models import (
    AuditEvent,
    GuardianProfile,
    GuardianStudentLink,
    LocalAuthCredential,
    MembershipRole,
    Role,
    SchoolMembership,
    StudentProfile,
    User,
)
from app.modules.identity.schemas import (
    GuardianLinkCreate,
    GuardianProfileCreate,
    GuardianProfileUpdate,
    RolePermissionsUpdate,
    StudentProfileCreate,
    StudentProfileUpdate,
    UserCreate,
    UserUpdate,
)

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


HANDLE_PATTERN = re.compile(r"^[a-z][a-z0-9_]{2,19}$")


def _resolve_handle(db: Session, user: User, handle: str | None) -> str | None:
    """Normaliza+valida formato (3-20 caracteres, empieza con letra, solo
    letras/dígitos/guion bajo — evita handles solo numéricos, fáciles de confundir
    con un ID) y chequea unicidad global, sin aplicarlo todavía. Se hace acá (no con
    un `field_validator` de Pydantic: ningún otro schema de esta API lo usa) porque
    tanto el autoservicio (`PATCH /me`) como la edición admin (`PATCH /users/{id}`,
    en nombre de otro usuario) necesitan exactamente la misma regla."""
    if handle is None:
        return None
    normalized = handle.strip().lstrip("@").lower()
    if not HANDLE_PATTERN.match(normalized):
        raise UnprocessableError(
            "El usuario debe tener 3-20 caracteres, empezar con una letra y usar "
            "solo letras, números o guion bajo (ej. byronpena)."
        )
    if normalized != user.handle:
        existing = identity_repo.get_user_by_handle(db, normalized)
        if existing is not None and existing.id != user.id:
            raise ConflictError(f"El usuario '@{normalized}' ya está en uso.")
    return normalized


def update_my_handle(db: Session, user: User, handle: str | None) -> User:
    """Autoservicio (`PATCH /me`): cualquier usuario, sin importar su rol, puede
    elegir su propio `@handle` tageable. La columna igual tiene `UniqueConstraint`
    como respaldo ante condiciones de carrera."""
    user.handle = _resolve_handle(db, user, handle)
    db.commit()
    db.refresh(user)
    return user


def update_user(db: Session, user: User, payload: UserUpdate) -> User:
    """Edición admin (`PATCH /users/{id}`, requiere USERS_MANAGE): a diferencia de
    `PATCH /me`, puede fijar el `@handle` de OTRO usuario — p. ej. desde la ficha de
    un alumno que todavía no eligió uno. Nunca acepta roles aquí (sección 4: "no
    permitir modificar roles/alcances en un PATCH /users/{id} genérico") — eso vive
    en los endpoints de /role-assignments."""
    data = payload.model_dump(exclude_unset=True)
    if "handle" in data:
        data["handle"] = _resolve_handle(db, user, data["handle"])
    for field, value in data.items():
        setattr(user, field, value)
    db.commit()
    db.refresh(user)
    return user


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


def _require_unlinked_user(
    db: Session,
    current: CurrentMembership,
    user_id: uuid.UUID,
    *,
    exclude_profile_id: uuid.UUID | None,
) -> None:
    """Valida un `user_id` a vincular (al crear o editar un `StudentProfile`): debe
    tener membresía en este colegio y no estar ya vinculado a OTRO perfil."""
    if identity_repo.get_membership(db, current.school_id, user_id) is None:
        raise NotFoundError("El usuario indicado no existe en este colegio.")
    existing = identity_repo.get_student_profile_by_user(db, current.school_id, user_id)
    if existing is not None and existing.id != exclude_profile_id:
        raise ConflictError("Ese usuario ya tiene un perfil de alumno en este colegio.")


def create_student_profile(
    db: Session,
    current: CurrentMembership,
    payload: StudentProfileCreate,
    request_id: str | None,
) -> StudentProfile:
    """Alta de la identidad académica del alumno (sección 7: matrícula), separada a
    propósito de `create_user` — el modelo admite un `StudentProfile` sin cuenta
    todavía (`user_id` nullable), así que esto nunca crea un `User`; si se pasa
    `user_id`, solo vincula una cuenta que ya existe en este colegio. Nombres y
    fecha de nacimiento viven en el propio perfil (no en `User.display_name`)
    porque ese dato académico puede existir antes de que haya cuenta."""
    student_number = payload.student_number.strip()
    if not student_number:
        raise UnprocessableError("El número de alumno no puede estar vacío.")
    if identity_repo.get_student_profile_by_number(db, current.school_id, student_number):
        raise ConflictError(f"Ya existe un alumno con el número '{student_number}'.")

    if payload.user_id is not None:
        _require_unlinked_user(db, current, payload.user_id, exclude_profile_id=None)

    profile = StudentProfile(
        school_id=current.school_id,
        student_number=student_number,
        first_name=payload.first_name,
        last_name=payload.last_name,
        birth_date=payload.birth_date,
        user_id=payload.user_id,
    )
    db.add(profile)
    db.flush()
    record_audit_event(
        db,
        school_id=current.school_id,
        actor_id=current.membership.user_id,
        action="student_profile.create",
        target_type="student_profile",
        target_id=str(profile.id),
        request_id=request_id,
    )
    db.commit()
    db.refresh(profile)
    return profile


def _require_student_profile(
    db: Session, current: CurrentMembership, student_id: uuid.UUID
) -> StudentProfile:
    profile = identity_repo.get_student_profile(db, student_id)
    if profile is None or profile.school_id != current.school_id:
        raise NotFoundError("El alumno indicado no existe en este colegio.")
    return profile


def update_student_profile(
    db: Session,
    current: CurrentMembership,
    student_id: uuid.UUID,
    payload: StudentProfileUpdate,
    request_id: str | None,
) -> StudentProfile:
    profile = _require_student_profile(db, current, student_id)
    data = payload.model_dump(exclude_unset=True)
    if "user_id" in data and data["user_id"] is not None and data["user_id"] != profile.user_id:
        _require_unlinked_user(db, current, data["user_id"], exclude_profile_id=profile.id)
    for field, value in data.items():
        setattr(profile, field, value)
    record_audit_event(
        db,
        school_id=current.school_id,
        actor_id=current.membership.user_id,
        action="student_profile.update",
        target_type="student_profile",
        target_id=str(profile.id),
        request_id=request_id,
    )
    db.commit()
    db.refresh(profile)
    return profile


def _require_unlinked_guardian_user(
    db: Session,
    current: CurrentMembership,
    user_id: uuid.UUID,
    *,
    exclude_profile_id: uuid.UUID | None,
) -> None:
    """Igual que `_require_unlinked_user` pero para `GuardianProfile`: debe tener
    membresía en este colegio y no estar ya vinculado a OTRO perfil de tutor."""
    if identity_repo.get_membership(db, current.school_id, user_id) is None:
        raise NotFoundError("El usuario indicado no existe en este colegio.")
    existing = identity_repo.get_guardian_profile_by_user(db, current.school_id, user_id)
    if existing is not None and existing.id != exclude_profile_id:
        raise ConflictError("Ese usuario ya tiene un perfil de tutor en este colegio.")


def create_guardian_profile(
    db: Session,
    current: CurrentMembership,
    payload: GuardianProfileCreate,
    request_id: str | None,
) -> dict:
    """Alta de la ficha de contacto de un tutor (Administración > Tutores),
    independiente de `create_user`: el modelo admite un `GuardianProfile` sin
    cuenta de acceso (`user_id` nullable) porque la mayoría de tutores nunca
    necesita iniciar sesión, solo que el colegio tenga sus datos de contacto."""
    full_name = payload.full_name.strip()
    if not full_name:
        raise UnprocessableError("El nombre completo no puede estar vacío.")

    if payload.user_id is not None:
        _require_unlinked_guardian_user(db, current, payload.user_id, exclude_profile_id=None)

    profile = GuardianProfile(
        school_id=current.school_id,
        full_name=full_name,
        email=(payload.email or "").strip() or None,
        phone=(payload.phone or "").strip() or None,
        profession=(payload.profession or "").strip() or None,
        workplace=(payload.workplace or "").strip() or None,
        national_id=(payload.national_id or "").strip() or None,
        address=(payload.address or "").strip() or None,
        notes=(payload.notes or "").strip() or None,
        user_id=payload.user_id,
    )
    db.add(profile)
    db.flush()
    record_audit_event(
        db,
        school_id=current.school_id,
        actor_id=current.membership.user_id,
        action="guardian_profile.create",
        target_type="guardian_profile",
        target_id=str(profile.id),
        request_id=request_id,
    )
    db.commit()
    db.refresh(profile)
    return _build_guardian_profile_out(db, current, profile)


def _require_guardian_profile(
    db: Session, current: CurrentMembership, guardian_id: uuid.UUID
) -> GuardianProfile:
    profile = identity_repo.get_guardian_profile(db, current.school_id, guardian_id)
    if profile is None:
        raise NotFoundError("El tutor indicado no existe en este colegio.")
    return profile


def update_guardian_profile(
    db: Session,
    current: CurrentMembership,
    guardian_id: uuid.UUID,
    payload: GuardianProfileUpdate,
    request_id: str | None,
) -> dict:
    profile = _require_guardian_profile(db, current, guardian_id)
    data = payload.model_dump(exclude_unset=True)
    if "full_name" in data:
        cleaned = data["full_name"].strip()
        if not cleaned:
            raise UnprocessableError("El nombre completo no puede estar vacío.")
        data["full_name"] = cleaned
    if "user_id" in data and data["user_id"] is not None and data["user_id"] != profile.user_id:
        _require_unlinked_guardian_user(db, current, data["user_id"], exclude_profile_id=profile.id)
    for field, value in data.items():
        setattr(profile, field, value)
    record_audit_event(
        db,
        school_id=current.school_id,
        actor_id=current.membership.user_id,
        action="guardian_profile.update",
        target_type="guardian_profile",
        target_id=str(profile.id),
        request_id=request_id,
    )
    db.commit()
    db.refresh(profile)
    return _build_guardian_profile_out(db, current, profile)


def _build_guardian_profile_out(
    db: Session, current: CurrentMembership, profile: GuardianProfile
) -> dict:
    """Arma el dict de salida de un tutor con sus alumnos activos embebidos,
    cada uno con el grado actual (mejor esfuerzo, ver
    academics_repo.get_grade_level_names_for_students) — mismo patrón
    `_build_x_out` ya usado en learning/service.py para las publicaciones."""
    links = identity_repo.list_active_links_for_guardian(db, current.school_id, profile.id)
    student_ids = [link.student_id for link in links]
    grade_names = academics_repo.get_grade_level_names_for_students(
        db, current.school_id, student_ids
    )
    students = []
    for link in links:
        student = identity_repo.get_student_profile(db, link.student_id)
        if student is None:
            continue
        student_user = db.get(User, student.user_id) if student.user_id else None
        students.append(
            {
                "id": student.id,
                "display_name": student_display_name(
                    student, student_user.display_name if student_user else None
                ),
                "student_number": student.student_number,
                "grade_level_name": grade_names.get(student.id),
            }
        )
    return {
        "id": profile.id,
        "full_name": profile.full_name,
        "email": profile.email,
        "phone": profile.phone,
        "profession": profile.profession,
        "workplace": profile.workplace,
        "national_id": profile.national_id,
        "address": profile.address,
        "notes": profile.notes,
        "photo_file_id": profile.photo_file_id,
        "user_id": profile.user_id,
        "students": students,
    }


def list_guardian_profiles_with_students(db: Session, current: CurrentMembership) -> list[dict]:
    """Para la pantalla de Tutores (agrupada por grado en el frontend)."""
    profiles = identity_repo.list_guardian_profiles(db, current.school_id)
    return [_build_guardian_profile_out(db, current, profile) for profile in profiles]


def get_guardian_profile_detail(
    db: Session, current: CurrentMembership, guardian_id: uuid.UUID
) -> dict:
    profile = _require_guardian_profile(db, current, guardian_id)
    return _build_guardian_profile_out(db, current, profile)


def list_guardian_links(
    db: Session, current: CurrentMembership, user_id: uuid.UUID, student_id: uuid.UUID
) -> list[tuple[GuardianStudentLink, str | None, str | None]]:
    """Ver los tutores de un alumno es de solo lectura y usa el mismo guard
    amplio que el resto de su ficha —`require_student_access`: admin/
    coordinación, el docente que comparte un curso con él, su tutor vinculado,
    o el propio alumno— no el permiso angosto GUARDIAN_LINK_MANAGE (ese sigue
    protegiendo crear/revocar vínculos, más abajo). Import diferido para
    evitar el ciclo academics.service -> identity.service."""
    from app.modules.academics import service as academics_service

    academics_service.require_student_access(db, current, user_id, student_id)
    return identity_repo.list_guardian_links_for_student(db, current.school_id, student_id)


def create_guardian_link(
    db: Session,
    current: CurrentMembership,
    student_id: uuid.UUID,
    payload: GuardianLinkCreate,
    request_id: str | None,
) -> GuardianStudentLink:
    _require_student_profile(db, current, student_id)
    if identity_repo.get_guardian_profile(db, current.school_id, payload.guardian_id) is None:
        raise NotFoundError("El tutor indicado no existe en este colegio.")
    if identity_repo.get_active_guardian_link_for_pair(
        db, current.school_id, payload.guardian_id, student_id
    ):
        raise ConflictError("Ese tutor ya está vinculado a este alumno.")

    link = GuardianStudentLink(
        school_id=current.school_id,
        guardian_id=payload.guardian_id,
        student_id=student_id,
        relationship_label=payload.relationship_label,
        status="active",
        valid_from=payload.valid_from,
        valid_to=payload.valid_to,
    )
    db.add(link)
    db.flush()
    record_audit_event(
        db,
        school_id=current.school_id,
        actor_id=current.membership.user_id,
        action="guardian_link.create",
        target_type="guardian_student_link",
        target_id=str(link.id),
        request_id=request_id,
    )
    db.commit()
    db.refresh(link)
    return link


def revoke_guardian_link(
    db: Session,
    current: CurrentMembership,
    student_id: uuid.UUID,
    link_id: uuid.UUID,
    request_id: str | None,
) -> GuardianStudentLink:
    _require_student_profile(db, current, student_id)
    link = identity_repo.get_guardian_link(db, current.school_id, link_id)
    if link is None or link.student_id != student_id:
        raise NotFoundError("El vínculo indicado no existe para este alumno.")
    if link.status != "inactive":
        link.status = "inactive"
        record_audit_event(
            db,
            school_id=current.school_id,
            actor_id=current.membership.user_id,
            action="guardian_link.revoke",
            target_type="guardian_student_link",
            target_id=str(link.id),
            request_id=request_id,
        )
        db.commit()
        db.refresh(link)
    return link


def student_display_name(
    profile: StudentProfile, linked_user_display_name: str | None
) -> str | None:
    """Nombre a mostrar para un alumno: prioriza nombres propios del perfil (existen
    aunque no tenga cuenta todavía) y solo cae al `display_name` de la cuenta
    vinculada para los perfiles creados antes de que existieran esos campos."""
    if profile.first_name or profile.last_name:
        return " ".join(part for part in (profile.first_name, profile.last_name) if part)
    return linked_user_display_name


def list_linked_students(db: Session, guardian_user_id: uuid.UUID) -> list[dict]:
    links = identity_repo.get_active_guardian_links_for_user_any_school(db, guardian_user_id)
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
                "display_name": student_display_name(
                    profile, student_user.display_name if student_user else None
                ),
                "relationship_label": link.relationship_label,
            }
        )
    return results
