"""Pruebas obligatorias de la sección 19 relacionadas con aislamiento y autorización."""

from __future__ import annotations

from app.core.config import get_settings
from app.core.security import issue_local_token
from tests import factories as f

settings = get_settings()


def test_student_cannot_see_another_students_submissions(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)

    student_a_user = f.create_user(db_session, display_name="Alumno A", cognito_sub=f"a-{unique_suffix}")
    student_b_user = f.create_user(db_session, display_name="Alumno B", cognito_sub=f"b-{unique_suffix}")
    f.add_membership(db_session, school=school, user=student_a_user, role_codes=["student"])
    f.add_membership(db_session, school=school, user=student_b_user, role_codes=["student"])

    profile_a = f.enroll_student(
        db_session, school=school, structure=structure, student_user=student_a_user, student_number=f"A-{unique_suffix}"
    )["profile"]
    f.enroll_student(
        db_session, school=school, structure=structure, student_user=student_b_user, student_number=f"B-{unique_suffix}"
    )
    db_session.commit()

    headers_b = f.auth_headers(student_b_user, school_id=school.id)
    response = client.get(f"/api/v1/students/{profile_a.id}/submissions", headers=headers_b)

    assert response.status_code == 404


def test_guardian_only_sees_active_links(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)

    guardian_user = f.create_user(db_session, display_name="Tutor", cognito_sub=f"g-{unique_suffix}")
    student_user = f.create_user(db_session, display_name="Alumno", cognito_sub=f"s-{unique_suffix}")
    f.add_membership(db_session, school=school, user=guardian_user, role_codes=["guardian"])
    f.add_membership(db_session, school=school, user=student_user, role_codes=["student"])

    enrolled = f.enroll_student(
        db_session, school=school, structure=structure, student_user=student_user, student_number=f"S-{unique_suffix}"
    )
    f.link_guardian(
        db_session, school=school, guardian_user=guardian_user, student_profile=enrolled["profile"], status="inactive"
    )
    db_session.commit()

    headers = f.auth_headers(guardian_user, school_id=school.id)
    response = client.get("/api/v1/me/students", headers=headers)

    assert response.status_code == 200
    assert response.json() == []


def test_token_with_wrong_scope_is_rejected(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    user = f.create_user(db_session, display_name="Admin", cognito_sub=f"adm-{unique_suffix}")
    f.add_membership(db_session, school=school, user=user, role_codes=["school_admin"])
    db_session.commit()

    bad_token = issue_local_token(settings, cognito_sub=user.cognito_sub, scope="other-api/access")
    response = client.get(
        "/api/v1/me", headers={"Authorization": f"Bearer {bad_token}"}
    )

    assert response.status_code == 401


def test_inactive_user_loses_access_even_with_valid_token(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    user = f.create_user(db_session, display_name="Docente", cognito_sub=f"t-{unique_suffix}")
    f.add_membership(db_session, school=school, user=user, role_codes=["teacher"])
    db_session.commit()

    headers = f.auth_headers(user, school_id=school.id)
    ok_response = client.get("/api/v1/me", headers=headers)
    assert ok_response.status_code == 200

    user.status = "inactive"
    db_session.commit()

    response = client.get("/api/v1/me", headers=headers)
    assert response.status_code == 401


def test_teacher_loses_course_access_when_unassigned(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)
    teacher = f.create_user(db_session, display_name="Docente", cognito_sub=f"tt-{unique_suffix}")
    f.add_membership(db_session, school=school, user=teacher, role_codes=["teacher"])
    course_teacher = f.assign_teacher(
        db_session, school=school, course=structure["course"], teacher_user=teacher
    )
    db_session.commit()

    headers = f.auth_headers(teacher, school_id=school.id)
    ok_response = client.get(f"/api/v1/courses/{structure['course'].id}", headers=headers)
    assert ok_response.status_code == 200

    course_teacher.status = "inactive"
    db_session.commit()

    response = client.get(f"/api/v1/courses/{structure['course'].id}", headers=headers)
    assert response.status_code == 404


def test_cross_school_course_is_not_found(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school_1 = f.create_school(db_session, f"Escuela1 {unique_suffix}")
    school_2 = f.create_school(db_session, f"Escuela2 {unique_suffix}")
    structure_2 = f.create_academic_structure(db_session, school_2)

    admin_1 = f.create_user(db_session, display_name="Admin1", cognito_sub=f"a1-{unique_suffix}")
    f.add_membership(db_session, school=school_1, user=admin_1, role_codes=["school_admin"])
    db_session.commit()

    headers = f.auth_headers(admin_1, school_id=school_1.id)
    response = client.get(f"/api/v1/courses/{structure_2['course'].id}", headers=headers)

    assert response.status_code == 404
