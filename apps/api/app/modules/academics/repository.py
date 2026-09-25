from __future__ import annotations

import uuid

from sqlalchemy import select
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


def list_academic_years(db: Session, school_id: uuid.UUID) -> list[AcademicYear]:
    stmt = select(AcademicYear).where(AcademicYear.school_id == school_id)
    return list(db.execute(stmt).scalars().all())


def get_academic_year(db: Session, school_id: uuid.UUID, year_id: uuid.UUID) -> AcademicYear | None:
    stmt = select(AcademicYear).where(
        AcademicYear.id == year_id, AcademicYear.school_id == school_id
    )
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


def list_sections(db: Session, school_id: uuid.UUID) -> list[Section]:
    stmt = select(Section).where(Section.school_id == school_id)
    return list(db.execute(stmt).scalars().all())


def get_section(db: Session, school_id: uuid.UUID, section_id: uuid.UUID) -> Section | None:
    stmt = select(Section).where(Section.id == section_id, Section.school_id == school_id)
    return db.execute(stmt).scalar_one_or_none()


def list_subjects(db: Session, school_id: uuid.UUID) -> list[Subject]:
    stmt = select(Subject).where(Subject.school_id == school_id)
    return list(db.execute(stmt).scalars().all())


def get_subject(db: Session, school_id: uuid.UUID, subject_id: uuid.UUID) -> Subject | None:
    stmt = select(Subject).where(Subject.id == subject_id, Subject.school_id == school_id)
    return db.execute(stmt).scalar_one_or_none()


def get_course(db: Session, school_id: uuid.UUID, course_id: uuid.UUID) -> Course | None:
    stmt = select(Course).where(
        Course.id == course_id, Course.school_id == school_id, Course.status != "deleted"
    )
    return db.execute(stmt).scalar_one_or_none()


def list_all_courses(db: Session, school_id: uuid.UUID) -> list[Course]:
    stmt = select(Course).where(Course.school_id == school_id, Course.status != "deleted")
    return list(db.execute(stmt).scalars().all())


def list_courses_taught_by(
    db: Session, school_id: uuid.UUID, teacher_user_id: uuid.UUID
) -> list[Course]:
    stmt = (
        select(Course)
        .join(CourseTeacher, CourseTeacher.course_id == Course.id)
        .where(
            Course.school_id == school_id,
            Course.status != "deleted",
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
            Course.status != "deleted",
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


def list_enrollments_for_student(
    db: Session, school_id: uuid.UUID, student_id: uuid.UUID
) -> list[Enrollment]:
    stmt = select(Enrollment).where(
        Enrollment.school_id == school_id, Enrollment.student_id == student_id
    )
    return list(db.execute(stmt).scalars().all())
