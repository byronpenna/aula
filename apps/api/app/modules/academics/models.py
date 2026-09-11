from __future__ import annotations

import uuid
from datetime import date

from sqlalchemy import ForeignKey, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, SchoolScopedMixin, TimestampMixin, UUIDPKMixin


class AcademicYear(UUIDPKMixin, TimestampMixin, SchoolScopedMixin, Base):
    __tablename__ = "academic_years"

    label: Mapped[str] = mapped_column(nullable=False)
    starts_on: Mapped[date] = mapped_column(nullable=False)
    ends_on: Mapped[date] = mapped_column(nullable=False)
    status: Mapped[str] = mapped_column(nullable=False, default="active")


class GradingPeriod(UUIDPKMixin, TimestampMixin, SchoolScopedMixin, Base):
    __tablename__ = "grading_periods"

    academic_year_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("academic_years.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(nullable=False)
    starts_on: Mapped[date] = mapped_column(nullable=False)
    ends_on: Mapped[date] = mapped_column(nullable=False)
    status: Mapped[str] = mapped_column(nullable=False, default="active")


class GradeLevel(UUIDPKMixin, TimestampMixin, SchoolScopedMixin, Base):
    __tablename__ = "grade_levels"

    name: Mapped[str] = mapped_column(nullable=False)
    sort_order: Mapped[int] = mapped_column(nullable=False, default=0)


class Section(UUIDPKMixin, TimestampMixin, SchoolScopedMixin, Base):
    __tablename__ = "sections"
    __table_args__ = (
        UniqueConstraint(
            "academic_year_id", "grade_level_id", "name", name="uq_section_year_grade_name"
        ),
    )

    academic_year_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("academic_years.id"), nullable=False
    )
    grade_level_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("grade_levels.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(nullable=False)


class Subject(UUIDPKMixin, TimestampMixin, SchoolScopedMixin, Base):
    __tablename__ = "subjects"
    __table_args__ = (UniqueConstraint("school_id", "code", name="uq_subject_code_per_school"),)

    code: Mapped[str] = mapped_column(nullable=False)
    name: Mapped[str] = mapped_column(nullable=False)


class Course(UUIDPKMixin, TimestampMixin, SchoolScopedMixin, Base):
    __tablename__ = "courses"
    __table_args__ = (
        UniqueConstraint(
            "section_id", "subject_id", "academic_year_id", name="uq_course_section_subject_year"
        ),
    )

    section_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sections.id"), nullable=False
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("subjects.id"), nullable=False
    )
    academic_year_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("academic_years.id"), nullable=False
    )
    status: Mapped[str] = mapped_column(nullable=False, default="active")


class CourseTeacher(UUIDPKMixin, TimestampMixin, SchoolScopedMixin, Base):
    __tablename__ = "course_teachers"
    __table_args__ = (
        UniqueConstraint("course_id", "teacher_user_id", name="uq_course_teacher"),
    )

    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("courses.id"), nullable=False
    )
    teacher_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    status: Mapped[str] = mapped_column(nullable=False, default="active")


class Enrollment(UUIDPKMixin, TimestampMixin, SchoolScopedMixin, Base):
    __tablename__ = "enrollments"

    academic_year_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("academic_years.id"), nullable=False
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("student_profiles.id"), nullable=False
    )
    section_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("sections.id"), nullable=False
    )
    starts_on: Mapped[date] = mapped_column(nullable=False)
    ends_on: Mapped[date | None] = mapped_column(nullable=True)
    status: Mapped[str] = mapped_column(nullable=False, default="active")


class CourseEnrollment(UUIDPKMixin, TimestampMixin, SchoolScopedMixin, Base):
    __tablename__ = "course_enrollments"
    __table_args__ = (
        UniqueConstraint("course_id", "student_id", name="uq_course_enrollment_student"),
    )

    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("courses.id"), nullable=False
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("student_profiles.id"), nullable=False
    )
    enrollment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("enrollments.id"), nullable=False
    )
    status: Mapped[str] = mapped_column(nullable=False, default="active")
