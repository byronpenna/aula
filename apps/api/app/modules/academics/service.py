"""Reglas de negocio de estructura académica y matrícula.

Regla universal (sección 6): toda referencia a una entidad padre se valida contra el
`school_id` efectivo de la membresía actual, no solo se filtra por PK. Esto compensa,
a nivel de aplicación, no tener todavía FKs compuestas `(school_id, parent_id)` en
cada tabla (ver nota en `db/base.py::SchoolScopedMixin` y `docs/IMPLEMENTATION_STATUS.md`).
"""

from __future__ import annotations

import uuid

from sqlalchemy.orm import Session

from app.core.deps import CurrentMembership
from app.core.errors import NotFoundError, UnprocessableError
from app.modules.academics import repository as academics_repo
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
from app.modules.academics.schemas import AcademicYearCreate, EnrollmentCreate
from app.modules.identity import repository as identity_repo
from app.modules.identity import service as identity_service


def create_academic_year(
    db: Session, current: CurrentMembership, payload: AcademicYearCreate, request_id: str | None
) -> AcademicYear:
    if payload.ends_on <= payload.starts_on:
        raise UnprocessableError("ends_on debe ser posterior a starts_on.")
    year = AcademicYear(
        school_id=current.school_id,
        label=payload.label,
        starts_on=payload.starts_on,
        ends_on=payload.ends_on,
    )
    db.add(year)
    db.flush()
    identity_service.record_audit_event(
        db,
        school_id=current.school_id,
        actor_id=current.membership.user_id,
        action="academic_year.create",
        target_type="academic_year",
        target_id=str(year.id),
        request_id=request_id,
    )
    db.commit()
    db.refresh(year)
    return year


def _require_grade_level(
    db: Session, school_id: uuid.UUID, grade_level_id: uuid.UUID
) -> GradeLevel:
    grade_level = academics_repo.get_grade_level(db, school_id, grade_level_id)
    if grade_level is None:
        raise NotFoundError("El grado indicado no existe en este colegio.")
    return grade_level


def _require_academic_year(db: Session, school_id: uuid.UUID, year_id: uuid.UUID) -> AcademicYear:
    year = academics_repo.get_academic_year(db, school_id, year_id)
    if year is None:
        raise NotFoundError("El año académico indicado no existe en este colegio.")
    return year


def create_grade_level(
    db: Session, current: CurrentMembership, name: str, sort_order: int
) -> GradeLevel:
    grade_level = GradeLevel(school_id=current.school_id, name=name, sort_order=sort_order)
    db.add(grade_level)
    db.commit()
    db.refresh(grade_level)
    return grade_level


def create_subject(db: Session, current: CurrentMembership, code: str, name: str) -> Subject:
    subject = Subject(school_id=current.school_id, code=code, name=name)
    db.add(subject)
    db.commit()
    db.refresh(subject)
    return subject


def create_section(
    db: Session, current: CurrentMembership, academic_year_id: uuid.UUID,
    grade_level_id: uuid.UUID, name: str,
) -> Section:
    _require_academic_year(db, current.school_id, academic_year_id)
    _require_grade_level(db, current.school_id, grade_level_id)
    section = Section(
        school_id=current.school_id,
        academic_year_id=academic_year_id,
        grade_level_id=grade_level_id,
        name=name,
    )
    db.add(section)
    db.commit()
    db.refresh(section)
    return section


def create_course(
    db: Session, current: CurrentMembership, section_id: uuid.UUID,
    subject_id: uuid.UUID, academic_year_id: uuid.UUID,
) -> Course:
    section = academics_repo.get_section(db, current.school_id, section_id)
    if section is None:
        raise NotFoundError("La sección indicada no existe en este colegio.")
    subject = academics_repo.get_subject(db, current.school_id, subject_id)
    if subject is None:
        raise NotFoundError("La materia indicada no existe en este colegio.")
    _require_academic_year(db, current.school_id, academic_year_id)

    course = Course(
        school_id=current.school_id,
        section_id=section_id,
        subject_id=subject_id,
        academic_year_id=academic_year_id,
    )
    db.add(course)
    db.commit()
    db.refresh(course)
    return course


def assign_teacher(
    db: Session, current: CurrentMembership, course_id: uuid.UUID, teacher_user_id: uuid.UUID
) -> CourseTeacher:
    course = academics_repo.get_course(db, current.school_id, course_id)
    if course is None:
        raise NotFoundError("El curso indicado no existe en este colegio.")
    membership = identity_repo.get_active_membership(db, teacher_user_id, current.school_id)
    if membership is None:
        raise UnprocessableError("El docente no tiene una membresía activa en este colegio.")

    course_teacher = CourseTeacher(
        school_id=current.school_id, course_id=course_id, teacher_user_id=teacher_user_id
    )
    db.add(course_teacher)
    db.commit()
    db.refresh(course_teacher)
    return course_teacher


def list_visible_courses(
    db: Session, current: CurrentMembership, user_id: uuid.UUID
) -> list[Course]:
    """Alcance de datos por rol (sección 6): admin/coordinación ven todo el colegio;
    docente solo cursos asignados; alumno/tutor solo cursos donde están matriculados."""
    if {"school_admin", "coordinator"} & current.role_codes:
        return academics_repo.list_all_courses(db, current.school_id)

    if "teacher" in current.role_codes:
        return academics_repo.list_courses_taught_by(db, current.school_id, user_id)

    student_ids: list[uuid.UUID] = []
    if "student" in current.role_codes:
        profile = identity_repo.get_student_profile_by_user(db, current.school_id, user_id)
        if profile:
            student_ids.append(profile.id)
    if "guardian" in current.role_codes:
        for link in identity_repo.get_active_guardian_links(db, user_id):
            if link.school_id == current.school_id:
                student_ids.append(link.student_id)

    return academics_repo.list_courses_for_students(db, current.school_id, student_ids)


def create_enrollment(
    db: Session, current: CurrentMembership, payload: EnrollmentCreate, request_id: str | None
) -> Enrollment:
    """La matrícula inicial genera inscripciones de cursos transaccionalmente
    (sección 7): todo se confirma en una sola transacción o nada."""
    _require_academic_year(db, current.school_id, payload.academic_year_id)
    section = academics_repo.get_section(db, current.school_id, payload.section_id)
    if section is None:
        raise NotFoundError("La sección indicada no existe en este colegio.")
    student = identity_repo.get_student_profile(db, payload.student_id)
    if student is None or student.school_id != current.school_id:
        raise NotFoundError("El alumno indicado no existe en este colegio.")

    enrollment = Enrollment(
        school_id=current.school_id,
        academic_year_id=payload.academic_year_id,
        student_id=payload.student_id,
        section_id=payload.section_id,
        starts_on=payload.starts_on,
    )
    db.add(enrollment)
    db.flush()

    for course_id in payload.course_ids:
        course = academics_repo.get_course(db, current.school_id, course_id)
        if course is None or course.section_id != payload.section_id:
            raise UnprocessableError(
                f"El curso {course_id} no existe en la sección indicada."
            )
        # Idempotente (sección 7, igual que el resto de la matrícula transaccional):
        # matricular otra vez en un curso donde ya está inscrito no debe romper la
        # transacción completa con un IntegrityError de la constraint única.
        if academics_repo.is_student_enrolled_in_course(db, course_id, payload.student_id):
            continue
        db.add(
            CourseEnrollment(
                school_id=current.school_id,
                course_id=course_id,
                student_id=payload.student_id,
                enrollment_id=enrollment.id,
            )
        )

    identity_service.record_audit_event(
        db,
        school_id=current.school_id,
        actor_id=current.membership.user_id,
        action="enrollment.create",
        target_type="enrollment",
        target_id=str(enrollment.id),
        request_id=request_id,
    )
    db.commit()
    db.refresh(enrollment)
    return enrollment


def require_course_access(
    db: Session, current: CurrentMembership, user_id: uuid.UUID, course: Course
) -> None:
    """Verificación de vínculo con el recurso, no solo colegio (sección 6)."""
    if course.school_id != current.school_id:
        raise NotFoundError("El curso indicado no existe en este colegio.")
    if {"school_admin", "coordinator"} & current.role_codes:
        return
    if "teacher" in current.role_codes and academics_repo.is_teacher_of_course(
        db, course.id, user_id
    ):
        return
    if "student" in current.role_codes:
        profile = identity_repo.get_student_profile_by_user(db, current.school_id, user_id)
        if profile and academics_repo.is_student_enrolled_in_course(db, course.id, profile.id):
            return
    if "guardian" in current.role_codes:
        for link in identity_repo.get_active_guardian_links(db, user_id):
            if link.school_id == current.school_id and academics_repo.is_student_enrolled_in_course(
                db, course.id, link.student_id
            ):
                return
    raise NotFoundError("El curso indicado no existe o no tienes acceso.")


def require_student_access(
    db: Session, current: CurrentMembership, user_id: uuid.UUID, student_id: uuid.UUID
) -> None:
    """Verifica vínculo con el alumno antes de exponer sus matrículas/entregas/notas
    (sección 6): docente solo si comparten un curso, alumno solo su propio perfil,
    tutor solo con vínculo activo. Responde 404 para no revelar existencia ajena."""
    student = identity_repo.get_student_profile(db, student_id)
    if student is None or student.school_id != current.school_id:
        raise NotFoundError("El alumno indicado no existe en este colegio.")

    if {"school_admin", "coordinator"} & current.role_codes:
        return
    if "student" in current.role_codes:
        profile = identity_repo.get_student_profile_by_user(db, current.school_id, user_id)
        if profile and profile.id == student_id:
            return
    if "guardian" in current.role_codes:
        for link in identity_repo.get_active_guardian_links(db, user_id):
            if link.school_id == current.school_id and link.student_id == student_id:
                return
    if "teacher" in current.role_codes:
        taught = academics_repo.list_courses_taught_by(db, current.school_id, user_id)
        for course in taught:
            if academics_repo.is_student_enrolled_in_course(db, course.id, student_id):
                return
    raise NotFoundError("El alumno indicado no existe o no tienes acceso.")
