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
    status: str
    memberships: list[MembershipOut]


class PermissionsOut(BaseModel):
    school_id: uuid.UUID
    permissions: list[str]


class StudentProfileOut(BaseModel):
    id: uuid.UUID
    student_number: str
    display_name: str | None


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


class UserListItemOut(BaseModel):
    id: uuid.UUID
    display_name: str
    email: str | None
    username: str | None
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
    guardian_user_id: uuid.UUID
    student_id: uuid.UUID
    relationship_label: str = "guardian"
    valid_from: date
    valid_to: date | None = None


class GuardianLinkOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    guardian_user_id: uuid.UUID
    student_id: uuid.UUID
    relationship_label: str
    status: str
    valid_from: date
    valid_to: date | None
