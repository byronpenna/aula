from __future__ import annotations

import uuid
from datetime import date, datetime

from pydantic import BaseModel, ConfigDict


class MembershipOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    school_id: uuid.UUID
    school_name: str
    status: str
    roles: list[str]


class MeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    display_name: str
    email: str | None
    handle: str | None
    status: str
    memberships: list[MembershipOut]


class MeUpdate(BaseModel):
    """Autoservicio (`PATCH /me`): a propósito solo `handle` — el resto del perfil
    (nombre, correo) lo sigue gestionando quien tenga USERS_MANAGE vía
    `PATCH /users/{id}` (sección 6). Formato/normalización se validan en
    `service.py::update_my_handle`, igual convención que el resto de la API (sin
    `field_validator` de Pydantic en ningún otro schema de este repo)."""

    handle: str | None = None


class PermissionsOut(BaseModel):
    school_id: uuid.UUID
    permissions: list[str]


class StudentProfileOut(BaseModel):
    id: uuid.UUID
    student_number: str
    display_name: str | None
    first_name: str | None
    last_name: str | None
    birth_date: date | None
    photo_file_id: uuid.UUID | None
    user_id: uuid.UUID | None


class StudentProfileCreate(BaseModel):
    """`user_id` es opcional a propósito: el modelo admite un alumno matriculable
    antes de tener cuenta (`StudentProfile.user_id` nullable, ver models.py) — se
    puede vincular una cuenta ya existente aquí o dejarlo para más adelante."""

    student_number: str
    first_name: str | None = None
    last_name: str | None = None
    birth_date: date | None = None
    user_id: uuid.UUID | None = None


class StudentProfileUpdate(BaseModel):
    """Todos los campos son opcionales vía `exclude_unset` (igual convención que
    `UserUpdate`): permite editar solo los datos personales, o solo vincular/
    cambiar la cuenta (`user_id`), sin tener que repetir el resto."""

    first_name: str | None = None
    last_name: str | None = None
    birth_date: date | None = None
    user_id: uuid.UUID | None = None


class StudentDetailOut(BaseModel):
    """Ficha de alumno (sección 6): mismo guard que sus matrículas/entregas —
    admin/coordinación, el propio alumno, su tutor vinculado, o un docente que
    comparta al menos un curso con él (academics_service.require_student_access)."""

    id: uuid.UUID
    student_number: str
    display_name: str | None
    email: str | None


class LinkedStudentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    student_id: uuid.UUID
    school_id: uuid.UUID
    student_number: str
    display_name: str | None
    relationship_label: str


class LocalLoginRequest(BaseModel):
    username: str
    password: str


class LocalLoginResponse(BaseModel):
    access_token: str
    token_type: str = "Bearer"
    expires_in: int


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    display_name: str
    email: str | None
    handle: str | None
    status: str


class UserCreate(BaseModel):
    display_name: str
    email: str | None = None
    username: str
    password: str
    role_code: str


class UserUpdate(BaseModel):
    display_name: str | None = None
    email: str | None = None
    # Permite a quien tenga USERS_MANAGE fijar el @handle de OTRO usuario (p. ej.
    # desde la ficha de un alumno) — normalización/unicidad se validan en
    # `service.py::_resolve_handle`, mismo helper que usa el autoservicio `PATCH /me`.
    handle: str | None = None


class UserListItemOut(BaseModel):
    id: uuid.UUID
    display_name: str
    email: str | None
    username: str | None
    handle: str | None
    membership_status: str
    role_codes: list[str]


class UserCreateOut(UserListItemOut):
    """Respuesta de `POST /users`: nunca lleva `temporary_password` a la vez que
    `invitation_sent=True` (la contraseña ya viajó por correo; no se duplica en la
    respuesta HTTP, que puede quedar en logs de acceso/proxy)."""

    invitation_sent: bool
    temporary_password: str | None


class PermissionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    code: str
    description: str


class RoleOut(BaseModel):
    code: str
    name: str
    is_system: bool
    version: int
    permission_codes: list[str]
    assigned_user_count: int


class RoleUserOut(BaseModel):
    id: uuid.UUID
    display_name: str
    email: str | None
    membership_status: str


class RoleAssignmentCreate(BaseModel):
    role_code: str


class RolePermissionsUpdate(BaseModel):
    expected_version: int
    permission_codes: list[str]


class AuditEventOut(BaseModel):
    id: uuid.UUID
    actor_id: uuid.UUID | None
    actor_display_name: str | None
    action: str
    target_type: str
    target_id: str
    occurred_at: datetime
    request_id: str | None


class GuardianLinkCreate(BaseModel):
    """`student_id` no va aquí: ya viaja en la URL (`POST /students/{id}/guardians`),
    igual convención que `RoleAssignmentCreate` no repite el `user_id` del path."""

    guardian_user_id: uuid.UUID
    relationship_label: str = "guardian"
    valid_from: date
    valid_to: date | None = None


class GuardianLinkOut(BaseModel):
    id: uuid.UUID
    guardian_user_id: uuid.UUID
    guardian_display_name: str | None
    student_id: uuid.UUID
    relationship_label: str
    status: str
    valid_from: date
    valid_to: date | None
