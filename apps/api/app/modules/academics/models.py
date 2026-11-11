from __future__ import annotations

import uuid
from datetime import date, time

from sqlalchemy import ForeignKey, Time, UniqueConstraint
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
    # "active" | "archived" (baja lógica; nunca se borra un grado con secciones
    # históricas, ver academics/service.py).
    status: Mapped[str] = mapped_column(nullable=False, default="active")


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
    status: Mapped[str] = mapped_column(nullable=False, default="active")


class Subject(UUIDPKMixin, TimestampMixin, SchoolScopedMixin, Base):
    __tablename__ = "subjects"
    __table_args__ = (UniqueConstraint("school_id", "code", name="uq_subject_code_per_school"),)

    code: Mapped[str] = mapped_column(nullable=False)
    name: Mapped[str] = mapped_column(nullable=False)
    status: Mapped[str] = mapped_column(nullable=False, default="active")


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
    starts_on: Mapped[date] = mapped_column(nullable=False)
    ends_on: Mapped[date] = mapped_column(nullable=False)
    # "active" | "archived" (baja lógica, sección 6: nunca se hace DELETE real de una
    # fila con tareas/entregas/matrículas dependientes). Un curso archivado sigue
    # siendo resoluble por ID (historial de tareas/entregas, ver
    # academics_repo.get_course), solo desaparece de los listados de navegación
    # (academics_repo.list_*) y ya no admite nuevas matrículas.
    status: Mapped[str] = mapped_column(nullable=False, default="active")
    # Nullable: la mayoría de cursos no tienen nombre propio todavía (el frontend
    # cae a "Curso {id[:8]}" cuando es None). Se edita aparte con PATCH
    # /courses/{id}/name (academics_service.rename_course), no con el PATCH
    # genérico del curso, para que el docente encargado también pueda ponerlo sin
    # darle permiso de mover el curso de sección/materia/año (academics:manage).
    name: Mapped[str | None] = mapped_column(nullable=True)
    # "virtual" | "presencial" | "mixto". Solo "presencial"/"mixto" admiten horario
    # de clases (ver CourseScheduleSlot más abajo); un curso "virtual" puede tener
    # slots ya cargados de un cambio de modalidad anterior, el service nunca los
    # borra automáticamente (ver academics_service.set_course_schedule), pero el
    # frontend solo los pide/ofrece crear cuando la modalidad no es "virtual".
    modality: Mapped[str] = mapped_column(nullable=False, default="virtual")


class CourseScheduleSlot(UUIDPKMixin, TimestampMixin, SchoolScopedMixin, Base):
    """Franja recurrente semanal de clase presencial de un curso (ej. "Lunes
    07:00-08:30, Aula 3"). Sin dependientes (a diferencia de ResourceSection o
    Course): reemplazar el horario completo de un curso es un DELETE real de
    las franjas anteriores + INSERT de las nuevas, nunca baja lógica (ver
    academics_service.set_course_schedule). El frontend expande estas franjas
    en ocurrencias del mes visible para pintarlas en CourseCalendarSection,
    igual que ya hace con las tareas — no se materializan como
    CourseCalendarEvent individuales."""

    __tablename__ = "course_schedule_slots"

    course_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("courses.id"), nullable=False, index=True
    )
    # 0 = lunes … 6 = domingo, mismo criterio que el grid de
    # CourseCalendarSection.tsx (`(getDay() + 6) % 7`).
    weekday: Mapped[int] = mapped_column(nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    location: Mapped[str | None] = mapped_column(nullable=True)


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
