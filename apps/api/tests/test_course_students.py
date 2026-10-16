"""Alumnado matriculado por curso (solo lectura) y nombre del curso, ambos
restringidos a quien administra ese curso puntual: admin/coordinación en todo el
colegio, o el docente asignado a ese curso (nunca otro docente, ni alumno/tutor)
— ver academics/service.py::require_course_staff_access."""

from __future__ import annotations

from tests import factories as f


def test_admin_lists_enrolled_students_and_renames_course(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)
    admin = f.create_user(db_session, display_name="Admin", cognito_sub=f"a-{unique_suffix}")
    f.add_membership(db_session, school=school, user=admin, role_codes=["school_admin"])
    student_user = f.create_user(
        db_session, display_name="Alumno Demo", cognito_sub=f"s-{unique_suffix}"
    )
    f.add_membership(db_session, school=school, user=student_user, role_codes=["student"])
    f.enroll_student(
        db_session,
        school=school,
        structure=structure,
        student_user=student_user,
        student_number=f"N-{unique_suffix}",
    )
    db_session.commit()

    headers = f.auth_headers(admin, school_id=school.id)
    course_id = structure["course"].id

    list_resp = client.get(f"/api/v1/courses/{course_id}/students", headers=headers)
    assert list_resp.status_code == 200, list_resp.text
    assert len(list_resp.json()) == 1
    assert list_resp.json()[0]["display_name"] == "Alumno Demo"
    # Solo lectura: el payload no trae nada editable del lado del alumno.
    assert set(list_resp.json()[0].keys()) == {"id", "student_number", "display_name"}

    rename_resp = client.patch(
        f"/api/v1/courses/{course_id}/name",
        headers=headers,
        json={"name": "  Matemática   6to A  "},
    )
    assert rename_resp.status_code == 200, rename_resp.text
    assert rename_resp.json()["name"] == "Matemática 6to A"

    get_resp = client.get(f"/api/v1/courses/{course_id}", headers=headers)
    assert get_resp.json()["name"] == "Matemática 6to A"


def test_assigned_teacher_can_manage_but_other_teacher_cannot(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)
    teacher = f.create_user(db_session, display_name="Docente Titular", cognito_sub=f"t-{unique_suffix}")
    f.add_membership(db_session, school=school, user=teacher, role_codes=["teacher"])
    f.assign_teacher(db_session, school=school, course=structure["course"], teacher_user=teacher)
    other_teacher = f.create_user(
        db_session, display_name="Otro Docente", cognito_sub=f"ot-{unique_suffix}"
    )
    f.add_membership(db_session, school=school, user=other_teacher, role_codes=["teacher"])
    student_user = f.create_user(db_session, display_name="Alumno", cognito_sub=f"s-{unique_suffix}")
    f.add_membership(db_session, school=school, user=student_user, role_codes=["student"])
    f.enroll_student(
        db_session,
        school=school,
        structure=structure,
        student_user=student_user,
        student_number=f"N-{unique_suffix}",
    )
    db_session.commit()

    course_id = structure["course"].id
    teacher_headers = f.auth_headers(teacher, school_id=school.id)

    list_resp = client.get(f"/api/v1/courses/{course_id}/students", headers=teacher_headers)
    assert list_resp.status_code == 200, list_resp.text
    assert len(list_resp.json()) == 1

    rename_resp = client.patch(
        f"/api/v1/courses/{course_id}/name",
        headers=teacher_headers,
        json={"name": "Matemática - Docente Titular"},
    )
    assert rename_resp.status_code == 200, rename_resp.text

    other_headers = f.auth_headers(other_teacher, school_id=school.id)
    forbidden_list = client.get(f"/api/v1/courses/{course_id}/students", headers=other_headers)
    assert forbidden_list.status_code == 403

    forbidden_rename = client.patch(
        f"/api/v1/courses/{course_id}/name",
        headers=other_headers,
        json={"name": "No debería aplicar"},
    )
    assert forbidden_rename.status_code == 403


def test_student_and_guardian_cannot_see_roster_or_rename(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)
    student_user = f.create_user(db_session, display_name="Alumno", cognito_sub=f"s-{unique_suffix}")
    f.add_membership(db_session, school=school, user=student_user, role_codes=["student"])
    f.enroll_student(
        db_session,
        school=school,
        structure=structure,
        student_user=student_user,
        student_number=f"N-{unique_suffix}",
    )
    guardian = f.create_user(db_session, display_name="Tutor", cognito_sub=f"g-{unique_suffix}")
    f.add_membership(db_session, school=school, user=guardian, role_codes=["guardian"])
    db_session.commit()

    course_id = structure["course"].id
    student_headers = f.auth_headers(student_user, school_id=school.id)
    guardian_headers = f.auth_headers(guardian, school_id=school.id)

    assert client.get(f"/api/v1/courses/{course_id}/students", headers=student_headers).status_code == 403
    assert client.get(f"/api/v1/courses/{course_id}/students", headers=guardian_headers).status_code == 403

    assert (
        client.patch(
            f"/api/v1/courses/{course_id}/name", headers=student_headers, json={"name": "x"}
        ).status_code
        == 403
    )
    assert (
        client.patch(
            f"/api/v1/courses/{course_id}/name", headers=guardian_headers, json={"name": "x"}
        ).status_code
        == 403
    )
    # Alumno y tutor siguen viendo el curso en sí (course:read); solo el alumnado y
    # el nombre quedan vedados.
    assert client.get(f"/api/v1/courses/{course_id}", headers=student_headers).status_code == 200


def test_rename_course_rejects_empty_name(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)
    admin = f.create_user(db_session, display_name="Admin", cognito_sub=f"a-{unique_suffix}")
    f.add_membership(db_session, school=school, user=admin, role_codes=["school_admin"])
    db_session.commit()

    headers = f.auth_headers(admin, school_id=school.id)
    resp = client.patch(
        f"/api/v1/courses/{structure['course'].id}/name",
        headers=headers,
        json={"name": "   "},
    )
    assert resp.status_code == 422
