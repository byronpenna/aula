from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.modules.files.schemas import FileOut


class AssignmentCreate(BaseModel):
    title: str
    instructions: str = ""
    due_at: datetime
    max_score: Decimal = Decimal(100)
    allow_late: bool = False


class AssignmentUpdate(BaseModel):
    title: str | None = None
    instructions: str | None = None
    due_at: datetime | None = None
    max_score: Decimal | None = None
    allow_late: bool | None = None


class AssignmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    course_id: uuid.UUID
    title: str
    instructions: str
    due_at: datetime
    max_score: Decimal
    status: str
    allow_late: bool


class SubmissionUpsert(BaseModel):
    body: str
    version: int


class SubmissionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    assignment_id: uuid.UUID
    student_id: uuid.UUID
    status: str
    submitted_at: datetime | None
    version: int
    late: bool = False


class SubmissionSubmitRequest(BaseModel):
    body: str | None = None
    version: int


class ResourceSectionCreate(BaseModel):
    name: str


class ResourceSectionUpdate(BaseModel):
    name: str


class ResourceSectionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    course_id: uuid.UUID
    name: str
    status: str


class ResourceSectionWithFilesOut(BaseModel):
    id: uuid.UUID
    name: str
    status: str
    files: list[FileOut]


class CourseResourcesOut(BaseModel):
    sections: list[ResourceSectionWithFilesOut]
    unsectioned_files: list[FileOut]
