#!/usr/bin/env python3
"""Seed idempotente de datos ficticios para desarrollo local (sección 17).

Crea: colegio demo, catálogo de roles/permisos, usuarios de cada rol con
credenciales locales (usuario/contraseña, solo válidas con APP_ENV=local), un año
académico, un grado, una sección, una materia, un curso, matrícula de un alumno,
vínculo de un tutor y una tarea publicada. Nada de esto es información real de un
colegio; los nombres son ficticios (docs/ASSUMPTIONS.md).

Uso: `make seed` o `python scripts/seed.py` desde `apps/api` con el venv activo.
"""

from __future__ import annotations

import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "apps" / "api"))

from app.core.permissions import ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS  # noqa: E402
from app.db.session import SessionLocal  # noqa: E402
from app.modules.academics.models import (  # noqa: E402
    AcademicYear,
    Course,
    CourseEnrollment,
    CourseTeacher,
    Enrollment,
    GradeLevel,
    Section,
    Subject,
)
from app.modules.identity.models import (  # noqa: E402
    GuardianStudentLink,
    LocalAuthCredential,
    MembershipRole,
    Permission,
    Role,
    RolePermission,
    School,
    SchoolMembership,
    StudentProfile,
    User,
)
from app.modules.identity.service import hash_password  # noqa: E402
from app.modules.learning.models import Assignment  # noqa: E402

LOCAL_DEV_PASSWORD = "aula-local-dev"


def get_or_create(db, model, defaults=None, **filters):
    instance = db.query(model).filter_by(**filters).one_or_none()
    if instance:
        return instance, False
    params = {**filters, **(defaults or {})}
    instance = model(**params)
    db.add(instance)
    db.flush()
    return instance, True


def ensure_user_with_login(db, *, display_name, email, username, roles_by_school):
    user, _ = get_or_create(
        db, User, display_name=display_name, defaults={"email": email, "status": "active"}
    )
    if user.cognito_sub is None:
        user.cognito_sub = f"local|{username}"
    get_or_create(
        db,
        LocalAuthCredential,
        username=username,
        defaults={"user_id": user.id, "password_hash": hash_password(LOCAL_DEV_PASSWORD)},
    )
    for school, role_codes in roles_by_school:
        membership, _ = get_or_create(
            db,
            SchoolMembership,
            school_id=school.id,
            user_id=user.id,
            defaults={"status": "active"},
        )
        for code in role_codes:
            role = db.query(Role).filter_by(code=code).one()
            get_or_create(db, MembershipRole, membership_id=membership.id, role_id=role.id)
    return user


def main() -> None:
    db = SessionLocal()
    try:
        # --- Catálogo de permisos y roles ---
        for code, description in ALL_PERMISSIONS.items():
            get_or_create(db, Permission, code=code, defaults={"description": description})
        for role_code in DEFAULT_ROLE_PERMISSIONS:
            get_or_create(db, Role, code=role_code, defaults={"name": role_code.replace("_", " ").title()})
        db.flush()

        for role_code, perm_codes in DEFAULT_ROLE_PERMISSIONS.items():
            role = db.query(Role).filter_by(code=role_code).one()
            for perm_code in perm_codes:
                permission = db.query(Permission).filter_by(code=perm_code).one()
                get_or_create(db, RolePermission, role_id=role.id, permission_id=permission.id)

        # --- Colegio demo ---
        school, _ = get_or_create(
            db,
            School,
            name="Colegio Demo",
            defaults={"timezone": "America/El_Salvador", "currency": "USD", "status": "active"},
        )
        db.flush()

        admin = ensure_user_with_login(
            db,
            display_name="Admin Demo",
            email="admin@example.local",
            username="admin.demo",
            roles_by_school=[(school, ["school_admin"])],
        )
        teacher = ensure_user_with_login(
            db,
            display_name="Docente Demo",
            email="docente@example.local",
            username="docente.demo",
            roles_by_school=[(school, ["teacher"])],
        )
        student_user = ensure_user_with_login(
            db,
            display_name="Alumno Demo",
            email=None,
            username="alumno.demo",
            roles_by_school=[(school, ["student"])],
        )
        guardian = ensure_user_with_login(
            db,
            display_name="Tutor Demo",
            email="tutor@example.local",
            username="tutor.demo",
            roles_by_school=[(school, ["guardian"])],
        )
        db.flush()

        # --- Estructura académica ---
        year, _ = get_or_create(
            db,
            AcademicYear,
            school_id=school.id,
            label="2026",
            defaults={"starts_on": date(2026, 1, 15), "ends_on": date(2026, 11, 15), "status": "active"},
        )
        grade, _ = get_or_create(
            db, GradeLevel, school_id=school.id, name="Sexto grado", defaults={"sort_order": 6}
        )
        section, _ = get_or_create(
            db,
            Section,
            school_id=school.id,
            academic_year_id=year.id,
            grade_level_id=grade.id,
            name="A",
        )
        subject, _ = get_or_create(
            db, Subject, school_id=school.id, code="MAT6", defaults={"name": "Matemática"}
        )
        course, _ = get_or_create(
            db,
            Course,
            school_id=school.id,
            section_id=section.id,
            subject_id=subject.id,
            academic_year_id=year.id,
            defaults={"status": "active"},
        )
        get_or_create(
            db,
            CourseTeacher,
            school_id=school.id,
            course_id=course.id,
            teacher_user_id=teacher.id,
            defaults={"status": "active"},
        )
        db.flush()

        # --- Alumno, matrícula y vínculo de tutor ---
        student_profile, _ = get_or_create(
            db,
            StudentProfile,
            school_id=school.id,
            student_number="2026-0001",
            defaults={"user_id": student_user.id},
        )
        db.flush()

        enrollment, _ = get_or_create(
            db,
            Enrollment,
            school_id=school.id,
            academic_year_id=year.id,
            student_id=student_profile.id,
            section_id=section.id,
            defaults={"starts_on": date(2026, 1, 15), "status": "active"},
        )
        get_or_create(
            db,
            CourseEnrollment,
            school_id=school.id,
            course_id=course.id,
            student_id=student_profile.id,
            defaults={"enrollment_id": enrollment.id, "status": "active"},
        )
        get_or_create(
            db,
            GuardianStudentLink,
            school_id=school.id,
            guardian_user_id=guardian.id,
            student_id=student_profile.id,
            defaults={
                "relationship_label": "madre/padre",
                "status": "active",
                "valid_from": date(2026, 1, 15),
            },
        )

        # --- Tarea publicada de ejemplo ---
        get_or_create(
            db,
            Assignment,
            school_id=school.id,
            course_id=course.id,
            title="Tarea de práctica: fracciones",
            defaults={
                "instructions": "Resuelve los ejercicios 1 a 10 de la guía.",
                "due_at": datetime.now(timezone.utc) + timedelta(days=7),
                "max_score": 100,
                "status": "published",
                "allow_late": False,
            },
        )

        db.commit()
        print("Seed completado. Usuarios locales (contraseña para todos: 'aula-local-dev'):")
        print("  admin.demo / docente.demo / alumno.demo / tutor.demo")
    finally:
        db.close()


if __name__ == "__main__":
    main()
