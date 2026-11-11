from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict

from app.modules.files.schemas import FileOut


class AssignmentCreate(BaseModel):
    title: str
    instructions: str = ""
    due_at: datetime
    max_score: Decimal = Decimal(100)
    allow_late: bool = False


class CourseCalendarEventCreate(BaseModel):
    title: str
    description: str | None = None
    event_date: date


class CourseCalendarEventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    course_id: uuid.UUID
    title: str
    description: str | None
    event_date: date
    created_at: datetime


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


class ResourceLinkCreate(BaseModel):
    title: str
    url: str


class ResourceLinkOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    resource_section_id: uuid.UUID
    title: str
    url: str
    created_at: datetime


class ResourceLinkCommentCreate(BaseModel):
    body: str


class ResourceLinkCommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    resource_link_id: uuid.UUID
    author_user_id: uuid.UUID
    author_name: str = ""
    body: str
    created_at: datetime


class ResourceSectionWithFilesOut(BaseModel):
    id: uuid.UUID
    name: str
    status: str
    files: list[FileOut]
    links: list[ResourceLinkOut]


class CourseResourcesOut(BaseModel):
    sections: list[ResourceSectionWithFilesOut]
    unsectioned_files: list[FileOut]
    unsectioned_links: list[ResourceLinkOut]


class CoursePostPollOptionCreate(BaseModel):
    label: str


class CoursePostPollCreate(BaseModel):
    question: str
    allow_multiple: bool = False
    options: list[CoursePostPollOptionCreate]


class CoursePostCreate(BaseModel):
    body: str
    poll: CoursePostPollCreate | None = None


class CoursePostPollOptionOut(BaseModel):
    id: uuid.UUID
    label: str
    vote_count: int
    voted_by_me: bool


class CoursePostPollOut(BaseModel):
    id: uuid.UUID
    question: str
    allow_multiple: bool
    total_votes: int
    options: list[CoursePostPollOptionOut]


class CoursePostOut(BaseModel):
    id: uuid.UUID
    course_id: uuid.UUID
    author_user_id: uuid.UUID
    author_name: str = ""
    body: str
    created_at: datetime
    images: list[FileOut]
    poll: CoursePostPollOut | None
    comment_count: int


class CoursePostCommentCreate(BaseModel):
    body: str


class CoursePostCommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    post_id: uuid.UUID
    author_user_id: uuid.UUID
    author_name: str = ""
    body: str
    created_at: datetime


class PollVoteRequest(BaseModel):
    option_ids: list[uuid.UUID]
