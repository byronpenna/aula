from __future__ import annotations

import uuid
from datetime import date

from pydantic import BaseModel, ConfigDict


class RoleOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    code: str
    name: str


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


class UserInvitationCreate(BaseModel):
    school_id: uuid.UUID
    display_name: str
    email: str | None = None
    role_codes: list[str]


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    display_name: str
    email: str | None
    status: str


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
