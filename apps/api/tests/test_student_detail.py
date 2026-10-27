"""Ficha de alumno (datos + cursos en los que está matriculado): mismo guard que
sus matrículas (academics/service.py::require_student_access) — admin/
coordinación, el docente que comparte un curso con él, su tutor vinculado, o el
propio alumno; nunca un docente ajeno. Responde 404 (no 403) para no revelar
existencia ajena, igual que /students/{id}/enrollments."""

from __future__ import annotations

from app.modules.identity.models import StudentProfile
from tests import factories as f


def test_admin_and_sharing_teacher_see_detail_and_courses(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)
    admin = f.create_user(db_session, display_name="Admin", cognito_sub=f"a-{unique_suffix}")
    f.add_membership(db_session, school=school, user=admin, role_codes=["school_admin"])
    teacher = f.create_user(db_session, display_name="Docente", cognito_sub=f"t-{unique_suffix}")
    f.add_membership(db_session, school=school, user=teacher, role_codes=["teacher"])
    f.assign_teacher(db_session, school=school, course=structure["course"], teacher_user=teacher)
    student_user = f.create_user(
        db_session, display_name="Alumno Demo", cognito_sub=f"s-{unique_suffix}"
    )
    student_user.email = f"alumno{unique_suffix}@example.com"
    f.add_membership(db_session, school=school, user=student_user, role_codes=["student"])
    enrolled = f.enroll_student(
        db_session,
        school=school,
        structure=structure,
        student_user=student_user,
        student_number=f"N-{unique_suffix}",
    )
    db_session.commit()

    student_id = enrolled["profile"].id
    course_id = structure["course"].id

    for headers in (f.auth_headers(admin, school_id=school.id), f.auth_headers(teacher, school_id=school.id)):
        detail_resp = client.get(f"/api/v1/students/{student_id}", headers=headers)
        assert detail_resp.status_code == 200, detail_resp.text
        body = detail_resp.json()
        assert body["display_name"] == "Alumno Demo"
        assert body["student_number"] == f"N-{unique_suffix}"
        assert body["email"] == f"alumno{unique_suffix}@example.com"

        courses_resp = client.get(f"/api/v1/students/{student_id}/courses", headers=headers)
        assert courses_resp.status_code == 200, courses_resp.text
        assert [c["id"] for c in courses_resp.json()] == [str(course_id)]


def test_guardian_and_self_can_view_but_unrelated_teacher_cannot(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)
    student_user = f.create_user(db_session, display_name="Alumno", cognito_sub=f"s-{unique_suffix}")
    f.add_membership(db_session, school=school, user=student_user, role_codes=["student"])
    enrolled = f.enroll_student(
        db_session,
        school=school,
        structure=structure,
        student_user=student_user,
        student_number=f"N-{unique_suffix}",
    )
    guardian = f.create_user(db_session, display_name="Tutor", cognito_sub=f"g-{unique_suffix}")
    f.add_membership(db_session, school=school, user=guardian, role_codes=["guardian"])
    f.link_guardian(db_session, school=school, guardian_user=guardian, student_profile=enrolled["profile"])

    other_teacher = f.create_user(
        db_session, display_name="Docente Ajeno", cognito_sub=f"ot-{unique_suffix}"
    )
    f.add_membership(db_session, school=school, user=other_teacher, role_codes=["teacher"])
    db_session.commit()

    student_id = enrolled["profile"].id

    self_resp = client.get(
        f"/api/v1/students/{student_id}", headers=f.auth_headers(student_user, school_id=school.id)
    )
    assert self_resp.status_code == 200, self_resp.text

    guardian_resp = client.get(
        f"/api/v1/students/{student_id}", headers=f.auth_headers(guardian, school_id=school.id)
    )
    assert guardian_resp.status_code == 200, guardian_resp.text

    forbidden_resp = client.get(
        f"/api/v1/students/{student_id}", headers=f.auth_headers(other_teacher, school_id=school.id)
    )
    assert forbidden_resp.status_code == 404

    forbidden_courses = client.get(
        f"/api/v1/students/{student_id}/courses",
        headers=f.auth_headers(other_teacher, school_id=school.id),
    )
    assert forbidden_courses.status_code == 404


def test_student_without_user_account_has_null_contact_fields(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)
    admin = f.create_user(db_session, display_name="Admin", cognito_sub=f"a-{unique_suffix}")
    f.add_membership(db_session, school=school, user=admin, role_codes=["school_admin"])

    profile = StudentProfile(school_id=school.id, user_id=None, student_number=f"NA-{unique_suffix}")
    db_session.add(profile)
    db_session.commit()

    resp = client.get(
        f"/api/v1/students/{profile.id}", headers=f.auth_headers(admin, school_id=school.id)
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["display_name"] is None
    assert resp.json()["email"] is None
    assert resp.json()["student_number"] == f"NA-{unique_suffix}"
