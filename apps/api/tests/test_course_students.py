"""Alumnado matriculado por curso (solo lectura), nombre del curso e inscripción
scopeada al curso, todos restringidos a quien administra ese curso puntual:
admin/coordinación en todo el colegio, o el docente asignado a ese curso (nunca
otro docente, ni alumno/tutor) — ver academics/service.py::require_course_staff_access."""

from __future__ import annotations

from sqlalchemy import select

from app.modules.academics.models import Enrollment
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


def test_admin_enrolls_student_in_course_from_scratch(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)
    admin = f.create_user(db_session, display_name="Admin", cognito_sub=f"a-{unique_suffix}")
    f.add_membership(db_session, school=school, user=admin, role_codes=["school_admin"])
    teacher = f.create_user(db_session, display_name="Docente", cognito_sub=f"t-{unique_suffix}")
    f.add_membership(db_session, school=school, user=teacher, role_codes=["teacher"])
    f.assign_teacher(db_session, school=school, course=structure["course"], teacher_user=teacher)

    from app.modules.identity.models import StudentProfile

    profile = StudentProfile(school_id=school.id, user_id=None, student_number=f"N-{unique_suffix}")
    db_session.add(profile)
    db_session.commit()

    headers = f.auth_headers(admin, school_id=school.id)
    course_id = structure["course"].id

    candidates = client.get(f"/api/v1/courses/{course_id}/enrollable-students", headers=headers)
    assert candidates.status_code == 200, candidates.text
    assert str(profile.id) in [s["id"] for s in candidates.json()]

    enroll_resp = client.post(
        f"/api/v1/courses/{course_id}/students", headers=headers, json={"student_id": str(profile.id)}
    )
    assert enroll_resp.status_code == 200, enroll_resp.text
    assert enroll_resp.json()["id"] == str(profile.id)

    roster = client.get(f"/api/v1/courses/{course_id}/students", headers=headers)
    assert str(profile.id) in [s["id"] for s in roster.json()]

    candidates_after = client.get(f"/api/v1/courses/{course_id}/enrollable-students", headers=headers)
    assert str(profile.id) not in [s["id"] for s in candidates_after.json()]

    # Idempotente: volver a inscribir al mismo alumno en el mismo curso no falla.
    repeat_resp = client.post(
        f"/api/v1/courses/{course_id}/students", headers=headers, json={"student_id": str(profile.id)}
    )
    assert repeat_resp.status_code == 200, repeat_resp.text


def test_enroll_reuses_existing_enrollment_in_same_section_year(db_session, client, unique_suffix):
    """Un segundo curso de la misma sección/año no debe crear otra Enrollment para
    el mismo alumno (sección 7: solo la CourseEnrollment es nueva)."""
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)
    admin = f.create_user(db_session, display_name="Admin", cognito_sub=f"a-{unique_suffix}")
    f.add_membership(db_session, school=school, user=admin, role_codes=["school_admin"])
    teacher = f.create_user(db_session, display_name="Docente", cognito_sub=f"t-{unique_suffix}")
    f.add_membership(db_session, school=school, user=teacher, role_codes=["teacher"])
    f.assign_teacher(db_session, school=school, course=structure["course"], teacher_user=teacher)

    student_user = f.create_user(db_session, display_name="Alumno", cognito_sub=f"s-{unique_suffix}")
    f.add_membership(db_session, school=school, user=student_user, role_codes=["student"])
    enrolled = f.enroll_student(
        db_session,
        school=school,
        structure=structure,
        student_user=student_user,
        student_number=f"N-{unique_suffix}",
    )

    from app.modules.academics.models import Subject

    second_subject = Subject(school_id=school.id, code=f"X{unique_suffix}", name="Otra materia")
    db_session.add(second_subject)
    db_session.flush()
    from app.modules.academics.models import Course

    second_course = Course(
        school_id=school.id,
        section_id=structure["section"].id,
        subject_id=second_subject.id,
        academic_year_id=structure["year"].id,
        starts_on=structure["year"].starts_on,
        ends_on=structure["year"].ends_on,
    )
    db_session.add(second_course)
    db_session.flush()
    f.assign_teacher(db_session, school=school, course=second_course, teacher_user=teacher)
    db_session.commit()

    headers = f.auth_headers(admin, school_id=school.id)
    enroll_resp = client.post(
        f"/api/v1/courses/{second_course.id}/students",
        headers=headers,
        json={"student_id": str(enrolled["profile"].id)},
    )
    assert enroll_resp.status_code == 200, enroll_resp.text

    count = db_session.execute(
        select(Enrollment).where(
            Enrollment.student_id == enrolled["profile"].id,
            Enrollment.section_id == structure["section"].id,
            Enrollment.academic_year_id == structure["year"].id,
        )
    ).scalars().all()
    assert len(count) == 1


def test_assigned_teacher_can_enroll_without_enrollment_manage_permission(db_session, client, unique_suffix):
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

    from app.modules.identity.models import StudentProfile

    profile = StudentProfile(school_id=school.id, user_id=None, student_number=f"N-{unique_suffix}")
    db_session.add(profile)
    db_session.commit()

    course_id = structure["course"].id
    teacher_headers = f.auth_headers(teacher, school_id=school.id)
    # El docente titular NO tiene enrollment:manage (ver DEFAULT_ROLE_PERMISSIONS),
    # y aun así puede inscribir dentro de su propio curso.
    enroll_resp = client.post(
        f"/api/v1/courses/{course_id}/students",
        headers=teacher_headers,
        json={"student_id": str(profile.id)},
    )
    assert enroll_resp.status_code == 200, enroll_resp.text

    other_headers = f.auth_headers(other_teacher, school_id=school.id)
    second_profile_resp = client.post(
        f"/api/v1/courses/{course_id}/students",
        headers=other_headers,
        json={"student_id": str(profile.id)},
    )
    assert second_profile_resp.status_code == 403


def test_enroll_rejects_archived_course_and_course_without_teacher(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)
    admin = f.create_user(db_session, display_name="Admin", cognito_sub=f"a-{unique_suffix}")
    f.add_membership(db_session, school=school, user=admin, role_codes=["school_admin"])

    from app.modules.identity.models import StudentProfile

    profile = StudentProfile(school_id=school.id, user_id=None, student_number=f"N-{unique_suffix}")
    db_session.add(profile)
    db_session.commit()

    headers = f.auth_headers(admin, school_id=school.id)
    course_id = structure["course"].id

    # Sin docente encargado todavía.
    no_teacher_resp = client.post(
        f"/api/v1/courses/{course_id}/students", headers=headers, json={"student_id": str(profile.id)}
    )
    assert no_teacher_resp.status_code == 422

    teacher = f.create_user(db_session, display_name="Docente", cognito_sub=f"t-{unique_suffix}")
    f.add_membership(db_session, school=school, user=teacher, role_codes=["teacher"])
    f.assign_teacher(db_session, school=school, course=structure["course"], teacher_user=teacher)
    db_session.commit()
    client.post(f"/api/v1/courses/{course_id}/archive", headers=headers)

    archived_resp = client.post(
        f"/api/v1/courses/{course_id}/students", headers=headers, json={"student_id": str(profile.id)}
    )
    assert archived_resp.status_code == 422


def test_student_and_guardian_cannot_enroll(db_session, client, unique_suffix):
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
    db_session.commit()

    course_id = structure["course"].id
    resp = client.post(
        f"/api/v1/courses/{course_id}/students",
        headers=f.auth_headers(student_user, school_id=school.id),
        json={"student_id": str(student_user.id)},
    )
    assert resp.status_code == 403

    candidates_resp = client.get(
        f"/api/v1/courses/{course_id}/enrollable-students",
        headers=f.auth_headers(student_user, school_id=school.id),
    )
    assert candidates_resp.status_code == 403
