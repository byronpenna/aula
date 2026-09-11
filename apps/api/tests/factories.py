"""Helpers para construir datos de prueba directamente vía ORM (no HTTP), y para
emitir tokens locales válidos para las pruebas de autenticación/autorización."""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, timedelta

from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.permissions import ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS
from app.core.security import issue_local_token
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
from app.modules.identity.models import (
    GuardianStudentLink,
    MembershipRole,
    Permission,
    Role,
    RolePermission,
    School,
    SchoolMembership,
    StudentProfile,
    User,
)
from app.modules.learning.models import Assignment

settings = get_settings()


def ensure_role_catalog(db: Session) -> None:
    for code, description in ALL_PERMISSIONS.items():
        if not db.query(Permission).filter_by(code=code).one_or_none():
            db.add(Permission(code=code, description=description))
    for role_code in DEFAULT_ROLE_PERMISSIONS:
        if not db.query(Role).filter_by(code=role_code).one_or_none():
            db.add(Role(code=role_code, name=role_code))
    db.flush()

    for role_code, perm_codes in DEFAULT_ROLE_PERMISSIONS.items():
        role = db.query(Role).filter_by(code=role_code).one()
        for perm_code in perm_codes:
            permission = db.query(Permission).filter_by(code=perm_code).one()
            exists = (
                db.query(RolePermission)
                .filter_by(role_id=role.id, permission_id=permission.id)
                .one_or_none()
            )
            if not exists:
                db.add(RolePermission(role_id=role.id, permission_id=permission.id))
    db.flush()


def create_school(db: Session, name: str = "Escuela de prueba") -> School:
    school = School(name=name, timezone="America/El_Salvador", currency="USD", status="active")
    db.add(school)
    db.flush()
    return school


def create_user(db: Session, *, display_name: str, cognito_sub: str) -> User:
    user = User(display_name=display_name, cognito_sub=cognito_sub, status="active")
    db.add(user)
    db.flush()
    return user


def add_membership(db: Session, *, school: School, user: User, role_codes: list[str]) -> SchoolMembership:
    membership = SchoolMembership(school_id=school.id, user_id=user.id, status="active")
    db.add(membership)
    db.flush()
    for code in role_codes:
        role = db.query(Role).filter_by(code=code).one()
        db.add(MembershipRole(membership_id=membership.id, role_id=role.id))
    db.flush()
    return membership


def token_for(user: User, scope: str | None = None) -> str:
    return issue_local_token(settings, cognito_sub=user.cognito_sub, scope=scope)


def auth_headers(user: User, *, school_id: uuid.UUID | None = None, scope: str | None = None) -> dict:
    headers = {"Authorization": f"Bearer {token_for(user, scope=scope)}"}
    if school_id:
        headers["X-School-Id"] = str(school_id)
    return headers


def create_academic_structure(db: Session, school: School) -> dict:
    year = AcademicYear(
        school_id=school.id, label="2026", starts_on=date(2026, 1, 1), ends_on=date(2026, 11, 30)
    )
    grade = GradeLevel(school_id=school.id, name="Primero", sort_order=1)
    db.add_all([year, grade])
    db.flush()
    section = Section(
        school_id=school.id, academic_year_id=year.id, grade_level_id=grade.id, name="A"
    )
    subject = Subject(school_id=school.id, code="MAT", name="Matemática")
    db.add_all([section, subject])
    db.flush()
    course = Course(
        school_id=school.id,
        section_id=section.id,
        subject_id=subject.id,
        academic_year_id=year.id,
    )
    db.add(course)
    db.flush()
    return {"year": year, "grade": grade, "section": section, "subject": subject, "course": course}


def enroll_student(
    db: Session, *, school: School, structure: dict, student_user: User, student_number: str
) -> dict:
    profile = StudentProfile(
        school_id=school.id, user_id=student_user.id, student_number=student_number
    )
    db.add(profile)
    db.flush()
    enrollment = Enrollment(
        school_id=school.id,
        academic_year_id=structure["year"].id,
        student_id=profile.id,
        section_id=structure["section"].id,
        starts_on=date(2026, 1, 15),
    )
    db.add(enrollment)
    db.flush()
    course_enrollment = CourseEnrollment(
        school_id=school.id,
        course_id=structure["course"].id,
        student_id=profile.id,
        enrollment_id=enrollment.id,
    )
    db.add(course_enrollment)
    db.flush()
    return {"profile": profile, "enrollment": enrollment, "course_enrollment": course_enrollment}


def assign_teacher(db: Session, *, school: School, course: Course, teacher_user: User) -> CourseTeacher:
    course_teacher = CourseTeacher(
        school_id=school.id, course_id=course.id, teacher_user_id=teacher_user.id
    )
    db.add(course_teacher)
    db.flush()
    return course_teacher


def link_guardian(
    db: Session, *, school: School, guardian_user: User, student_profile: StudentProfile, status: str = "active"
) -> GuardianStudentLink:
    link = GuardianStudentLink(
        school_id=school.id,
        guardian_user_id=guardian_user.id,
        student_id=student_profile.id,
        relationship_label="madre/padre",
        status=status,
        valid_from=date(2026, 1, 1),
    )
    db.add(link)
    db.flush()
    return link


def create_published_assignment(db: Session, *, school: School, course: Course, allow_late: bool = False) -> Assignment:
    assignment = Assignment(
        school_id=school.id,
        course_id=course.id,
        title="Tarea de prueba",
        instructions="Instrucciones",
        due_at=datetime.now(UTC) + timedelta(days=1),
        max_score=100,
        status="published",
        allow_late=allow_late,
    )
    db.add(assignment)
    db.flush()
    return assignment
