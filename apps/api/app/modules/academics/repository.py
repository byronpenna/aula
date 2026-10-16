from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.academics.models import (
    AcademicYear,
    Course,
    CourseEnrollment,
    CourseTeacher,
    Enrollment,
    GradeLevel,
    Section,
    Subject,
)
from app.modules.identity.models import StudentProfile, User


def list_academic_years(db: Session, school_id: uuid.UUID) -> list[AcademicYear]:
    stmt = select(AcademicYear).where(AcademicYear.school_id == school_id)
    return list(db.execute(stmt).scalars().all())


def get_academic_year(db: Session, school_id: uuid.UUID, year_id: uuid.UUID) -> AcademicYear | None:
    stmt = select(AcademicYear).where(
        AcademicYear.id == year_id, AcademicYear.school_id == school_id
    )
    return db.execute(stmt).scalar_one_or_none()


def find_academic_year_by_normalized_label(
    db: Session, school_id: uuid.UUID, normalized_label: str, exclude_id: uuid.UUID | None = None
) -> AcademicYear | None:
    stmt = select(AcademicYear).where(
        AcademicYear.school_id == school_id,
        func.lower(func.trim(AcademicYear.label)) == normalized_label,
    )
    if exclude_id is not None:
        stmt = stmt.where(AcademicYear.id != exclude_id)
    return db.execute(stmt).scalar_one_or_none()


def list_grade_levels(db: Session, school_id: uuid.UUID) -> list[GradeLevel]:
    stmt = select(GradeLevel).where(GradeLevel.school_id == school_id).order_by(
        GradeLevel.sort_order
    )
    return list(db.execute(stmt).scalars().all())


def get_grade_level(
    db: Session, school_id: uuid.UUID, grade_level_id: uuid.UUID
) -> GradeLevel | None:
    stmt = select(GradeLevel).where(
        GradeLevel.id == grade_level_id, GradeLevel.school_id == school_id
    )
    return db.execute(stmt).scalar_one_or_none()


def find_grade_level_by_normalized_name(
    db: Session, school_id: uuid.UUID, normalized_name: str, exclude_id: uuid.UUID | None = None
) -> GradeLevel | None:
    stmt = select(GradeLevel).where(
        GradeLevel.school_id == school_id,
        func.lower(func.trim(GradeLevel.name)) == normalized_name,
    )
    if exclude_id is not None:
        stmt = stmt.where(GradeLevel.id != exclude_id)
    return db.execute(stmt).scalar_one_or_none()


def list_sections(db: Session, school_id: uuid.UUID) -> list[Section]:
    stmt = select(Section).where(Section.school_id == school_id)
    return list(db.execute(stmt).scalars().all())


def get_section(db: Session, school_id: uuid.UUID, section_id: uuid.UUID) -> Section | None:
    stmt = select(Section).where(Section.id == section_id, Section.school_id == school_id)
    return db.execute(stmt).scalar_one_or_none()


def find_section_by_normalized_name(
    db: Session,
    school_id: uuid.UUID,
    academic_year_id: uuid.UUID,
    grade_level_id: uuid.UUID,
    normalized_name: str,
    exclude_id: uuid.UUID | None = None,
) -> Section | None:
    stmt = select(Section).where(
        Section.school_id == school_id,
        Section.academic_year_id == academic_year_id,
        Section.grade_level_id == grade_level_id,
        func.lower(func.trim(Section.name)) == normalized_name,
    )
    if exclude_id is not None:
        stmt = stmt.where(Section.id != exclude_id)
    return db.execute(stmt).scalar_one_or_none()


def list_subjects(db: Session, school_id: uuid.UUID) -> list[Subject]:
    stmt = select(Subject).where(Subject.school_id == school_id)
    return list(db.execute(stmt).scalars().all())


def get_subject(db: Session, school_id: uuid.UUID, subject_id: uuid.UUID) -> Subject | None:
    stmt = select(Subject).where(Subject.id == subject_id, Subject.school_id == school_id)
    return db.execute(stmt).scalar_one_or_none()


def find_subject_by_normalized_code(
    db: Session, school_id: uuid.UUID, normalized_code: str, exclude_id: uuid.UUID | None = None
) -> Subject | None:
    stmt = select(Subject).where(
        Subject.school_id == school_id,
        func.lower(func.trim(Subject.code)) == normalized_code,
    )
    if exclude_id is not None:
        stmt = stmt.where(Subject.id != exclude_id)
    return db.execute(stmt).scalar_one_or_none()


def get_course(db: Session, school_id: uuid.UUID, course_id: uuid.UUID) -> Course | None:
    """Resolución puntual por ID: incluye cursos archivados a propósito (un docente o
    alumno debe poder seguir abriendo una tarea/entrega histórica de un curso
    archivado). Solo los listados de navegación (`list_*` abajo) excluyen archivados."""
    stmt = select(Course).where(Course.id == course_id, Course.school_id == school_id)
    return db.execute(stmt).scalar_one_or_none()


def list_all_courses(db: Session, school_id: uuid.UUID) -> list[Course]:
    stmt = select(Course).where(Course.school_id == school_id, Course.status != "archived")
    return list(db.execute(stmt).scalars().all())


def list_courses_taught_by(
    db: Session, school_id: uuid.UUID, teacher_user_id: uuid.UUID
) -> list[Course]:
    stmt = (
        select(Course)
        .join(CourseTeacher, CourseTeacher.course_id == Course.id)
        .where(
            Course.school_id == school_id,
            Course.status != "archived",
            CourseTeacher.teacher_user_id == teacher_user_id,
            CourseTeacher.status == "active",
        )
    )
    return list(db.execute(stmt).scalars().all())


def list_courses_for_students(
    db: Session, school_id: uuid.UUID, student_ids: list[uuid.UUID]
) -> list[Course]:
    if not student_ids:
        return []
    stmt = (
        select(Course)
        .join(CourseEnrollment, CourseEnrollment.course_id == Course.id)
        .where(
            Course.school_id == school_id,
            Course.status != "archived",
            CourseEnrollment.student_id.in_(student_ids),
            CourseEnrollment.status == "active",
        )
        .distinct()
    )
    return list(db.execute(stmt).scalars().all())


def is_teacher_of_course(db: Session, course_id: uuid.UUID, teacher_user_id: uuid.UUID) -> bool:
    stmt = select(CourseTeacher).where(
        CourseTeacher.course_id == course_id,
        CourseTeacher.teacher_user_id == teacher_user_id,
        CourseTeacher.status == "active",
    )
    return db.execute(stmt).scalar_one_or_none() is not None


def get_course_teacher(
    db: Session, course_id: uuid.UUID, teacher_user_id: uuid.UUID
) -> CourseTeacher | None:
    stmt = select(CourseTeacher).where(
        CourseTeacher.course_id == course_id,
        CourseTeacher.teacher_user_id == teacher_user_id,
    )
    return db.execute(stmt).scalar_one_or_none()


def list_active_teacher_ids_for_course(db: Session, course_id: uuid.UUID) -> list[uuid.UUID]:
    stmt = select(CourseTeacher.teacher_user_id).where(
        CourseTeacher.course_id == course_id, CourseTeacher.status == "active"
    )
    return list(db.execute(stmt).scalars().all())


def course_has_active_teacher(db: Session, course_id: uuid.UUID) -> bool:
    stmt = select(CourseTeacher).where(
        CourseTeacher.course_id == course_id, CourseTeacher.status == "active"
    )
    return db.execute(stmt).scalar_one_or_none() is not None


def is_student_enrolled_in_course(db: Session, course_id: uuid.UUID, student_id: uuid.UUID) -> bool:
    stmt = select(CourseEnrollment).where(
        CourseEnrollment.course_id == course_id,
        CourseEnrollment.student_id == student_id,
        CourseEnrollment.status == "active",
    )
    return db.execute(stmt).scalar_one_or_none() is not None


def list_students_in_course(
    db: Session, course_id: uuid.UUID
) -> list[tuple[StudentProfile, str | None]]:
    """Alumnado matriculado activamente en un curso puntual, con el `display_name`
    del `User` vinculado (puede ser `None`: igual que en identity_repo.list_student_profiles,
    un alumno puede existir sin cuenta todavía)."""
    stmt = (
        select(StudentProfile, User.display_name)
        .join(CourseEnrollment, CourseEnrollment.student_id == StudentProfile.id)
        .outerjoin(User, User.id == StudentProfile.user_id)
        .where(CourseEnrollment.course_id == course_id, CourseEnrollment.status == "active")
        .order_by(StudentProfile.student_number)
    )
    return [(row[0], row[1]) for row in db.execute(stmt).all()]


def list_enrollments_for_student(
    db: Session, school_id: uuid.UUID, student_id: uuid.UUID
) -> list[Enrollment]:
    stmt = select(Enrollment).where(
        Enrollment.school_id == school_id, Enrollment.student_id == student_id
    )
    return list(db.execute(stmt).scalars().all())


def list_students_not_in_course(
    db: Session, school_id: uuid.UUID, course_id: uuid.UUID
) -> list[tuple[StudentProfile, str | None]]:
    """Candidatos para "Inscribir alumno" desde el curso (sección 6): todo el
    alumnado del colegio que todavía no tiene una CourseEnrollment activa en este
    curso puntual, con el mismo shape que list_students_in_course."""
    already_enrolled = select(CourseEnrollment.student_id).where(
        CourseEnrollment.course_id == course_id, CourseEnrollment.status == "active"
    )
    stmt = (
        select(StudentProfile, User.display_name)
        .outerjoin(User, User.id == StudentProfile.user_id)
        .where(StudentProfile.school_id == school_id, StudentProfile.id.not_in(already_enrolled))
        .order_by(StudentProfile.student_number)
    )
    return [(row[0], row[1]) for row in db.execute(stmt).all()]


def find_enrollment(
    db: Session,
    school_id: uuid.UUID,
    student_id: uuid.UUID,
    section_id: uuid.UUID,
    academic_year_id: uuid.UUID,
) -> Enrollment | None:
    """Reutilizada por enroll_student_in_course (sección 7): si el alumno ya tiene
    una matrícula en la sección/año del curso, se cuelga la CourseEnrollment nueva
    de esa en vez de crear una Enrollment duplicada."""
    stmt = select(Enrollment).where(
        Enrollment.school_id == school_id,
        Enrollment.student_id == student_id,
        Enrollment.section_id == section_id,
        Enrollment.academic_year_id == academic_year_id,
    )
    return db.execute(stmt).scalars().first()
