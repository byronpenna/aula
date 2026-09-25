from __future__ import annotations

import uuid
from datetime import date

from pydantic import BaseModel, ConfigDict


class AcademicYearCreate(BaseModel):
    label: str
    starts_on: date
    ends_on: date


class AcademicYearOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    label: str
    starts_on: date
    ends_on: date
    status: str


class GradeLevelCreate(BaseModel):
    name: str
    sort_order: int = 0


class GradeLevelOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    name: str
    sort_order: int


class SectionCreate(BaseModel):
    academic_year_id: uuid.UUID
    grade_level_id: uuid.UUID
    name: str


class SectionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    academic_year_id: uuid.UUID
    grade_level_id: uuid.UUID
    name: str


class SubjectCreate(BaseModel):
    code: str
    name: str


class SubjectOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    code: str
    name: str


class CourseCreate(BaseModel):
    section_id: uuid.UUID
    subject_id: uuid.UUID
    academic_year_id: uuid.UUID
    starts_on: date
    ends_on: date


class CourseUpdate(BaseModel):
    section_id: uuid.UUID | None = None
    subject_id: uuid.UUID | None = None
    academic_year_id: uuid.UUID | None = None
    starts_on: date | None = None
    ends_on: date | None = None


class CourseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    section_id: uuid.UUID
    subject_id: uuid.UUID
    academic_year_id: uuid.UUID
    starts_on: date
    ends_on: date
    status: str
    # Calculado en el router (sección 6): antes de matricular alumnos en un curso debe
    # existir al menos un docente activo asignado; el frontend usa esto para bloquear
    # la matrícula sin necesidad de una llamada aparte por curso.
    teacher_user_ids: list[uuid.UUID] = []


class CourseTeacherCreate(BaseModel):
    teacher_user_id: uuid.UUID


class CourseTeacherOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    course_id: uuid.UUID
    teacher_user_id: uuid.UUID
    status: str


class EnrollmentCreate(BaseModel):
    academic_year_id: uuid.UUID
    student_id: uuid.UUID
    section_id: uuid.UUID
    starts_on: date
    course_ids: list[uuid.UUID] = []


class EnrollmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    academic_year_id: uuid.UUID
    student_id: uuid.UUID
    section_id: uuid.UUID
    starts_on: date
    ends_on: date | None
    status: str


class CourseEnrollmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    course_id: uuid.UUID
    student_id: uuid.UUID
    status: str
