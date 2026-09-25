"""Gestión de cursos por administración: CRUD restringido, fechas obligatorias y
requisito de docente encargado antes de matricular (ver academics/service.py)."""

from __future__ import annotations

from tests import factories as f


def _course_payload(structure: dict, subject_id=None, **overrides) -> dict:
    payload = {
        "section_id": str(structure["section"].id),
        "subject_id": str(subject_id or structure["subject"].id),
        "academic_year_id": str(structure["year"].id),
        "starts_on": "2026-01-15",
        "ends_on": "2026-11-15",
    }
    payload.update(overrides)
    return payload


def _extra_subject(db_session, school, code: str):
    from app.modules.academics.models import Subject

    subject = Subject(school_id=school.id, code=code, name=f"Materia {code}")
    db_session.add(subject)
    db_session.flush()
    return subject


def test_teacher_cannot_manage_courses(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)
    teacher = f.create_user(db_session, display_name="Docente", cognito_sub=f"t-{unique_suffix}")
    f.add_membership(db_session, school=school, user=teacher, role_codes=["teacher"])
    db_session.commit()

    headers = f.auth_headers(teacher, school_id=school.id)
    create_resp = client.post(
        "/api/v1/courses", headers=headers, json=_course_payload(structure)
    )
    assert create_resp.status_code == 403

    update_resp = client.patch(
        f"/api/v1/courses/{structure['course'].id}", headers=headers, json={"starts_on": "2026-02-01"}
    )
    assert update_resp.status_code == 403

    archive_resp = client.post(
        f"/api/v1/courses/{structure['course'].id}/archive", headers=headers
    )
    assert archive_resp.status_code == 403


def test_course_requires_end_after_start(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)
    admin = f.create_user(db_session, display_name="Admin", cognito_sub=f"a-{unique_suffix}")
    f.add_membership(db_session, school=school, user=admin, role_codes=["school_admin"])
    db_session.commit()

    headers = f.auth_headers(admin, school_id=school.id)
    resp = client.post(
        "/api/v1/courses",
        headers=headers,
        json=_course_payload(structure, starts_on="2026-11-15", ends_on="2026-01-15"),
    )
    assert resp.status_code == 422


def test_admin_can_update_and_archive_course(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)
    admin = f.create_user(db_session, display_name="Admin", cognito_sub=f"a-{unique_suffix}")
    f.add_membership(db_session, school=school, user=admin, role_codes=["school_admin"])
    db_session.commit()

    subject = _extra_subject(db_session, school, f"X{unique_suffix}")
    db_session.commit()

    headers = f.auth_headers(admin, school_id=school.id)
    create_resp = client.post(
        "/api/v1/courses",
        headers=headers,
        json=_course_payload(structure, subject_id=subject.id),
    )
    assert create_resp.status_code == 200, create_resp.text
    course_id = create_resp.json()["id"]
    assert create_resp.json()["starts_on"] == "2026-01-15"
    assert create_resp.json()["teacher_user_ids"] == []

    update_resp = client.patch(
        f"/api/v1/courses/{course_id}",
        headers=headers,
        json={"starts_on": "2026-02-01", "ends_on": "2026-10-01"},
    )
    assert update_resp.status_code == 200, update_resp.text
    assert update_resp.json()["starts_on"] == "2026-02-01"
    assert update_resp.json()["ends_on"] == "2026-10-01"

    bad_update_resp = client.patch(
        f"/api/v1/courses/{course_id}",
        headers=headers,
        json={"starts_on": "2026-12-01"},
    )
    assert bad_update_resp.status_code == 422

    archive_resp = client.post(f"/api/v1/courses/{course_id}/archive", headers=headers)
    assert archive_resp.status_code == 200, archive_resp.text
    assert archive_resp.json()["status"] == "archived"

    # Un curso archivado sigue siendo resoluble por ID (historial de tareas/entregas),
    # solo desaparece del listado de navegación/matrícula.
    get_resp = client.get(f"/api/v1/courses/{course_id}", headers=headers)
    assert get_resp.status_code == 200
    assert get_resp.json()["status"] == "archived"

    list_resp = client.get("/api/v1/courses", headers=headers)
    assert course_id not in [c["id"] for c in list_resp.json()]

    activate_resp = client.post(f"/api/v1/courses/{course_id}/activate", headers=headers)
    assert activate_resp.status_code == 200
    assert activate_resp.json()["status"] == "active"

    list_resp_after = client.get("/api/v1/courses", headers=headers)
    assert course_id in [c["id"] for c in list_resp_after.json()]


def test_enrollment_blocked_without_teacher_assigned(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)
    admin = f.create_user(db_session, display_name="Admin", cognito_sub=f"a-{unique_suffix}")
    f.add_membership(db_session, school=school, user=admin, role_codes=["school_admin"])

    from app.modules.identity.models import StudentProfile

    profile = StudentProfile(
        school_id=school.id, user_id=None, student_number=f"S-{unique_suffix}"
    )
    db_session.add(profile)
    db_session.commit()

    headers = f.auth_headers(admin, school_id=school.id)
    enrollment_resp = client.post(
        "/api/v1/enrollments",
        headers=headers,
        json={
            "academic_year_id": str(structure["year"].id),
            "student_id": str(profile.id),
            "section_id": str(structure["section"].id),
            "starts_on": "2026-01-15",
            "course_ids": [str(structure["course"].id)],
        },
    )
    assert enrollment_resp.status_code == 422

    # Nada se creó: el rechazo ocurre antes de mutar (matrícula transaccional).
    enrollments_resp = client.get(
        f"/api/v1/students/{profile.id}/enrollments", headers=headers
    )
    assert enrollments_resp.status_code == 200
    assert enrollments_resp.json() == []

    teacher = f.create_user(db_session, display_name="Docente", cognito_sub=f"t-{unique_suffix}")
    f.add_membership(db_session, school=school, user=teacher, role_codes=["teacher"])
    db_session.commit()

    assign_resp = client.post(
        f"/api/v1/courses/{structure['course'].id}/teachers",
        headers=headers,
        json={"teacher_user_id": str(teacher.id)},
    )
    assert assign_resp.status_code == 200

    retry_resp = client.post(
        "/api/v1/enrollments",
        headers=headers,
        json={
            "academic_year_id": str(structure["year"].id),
            "student_id": str(profile.id),
            "section_id": str(structure["section"].id),
            "starts_on": "2026-01-15",
            "course_ids": [str(structure["course"].id)],
        },
    )
    assert retry_resp.status_code == 200, retry_resp.text


def test_assign_teacher_requires_teacher_role(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)
    admin = f.create_user(db_session, display_name="Admin", cognito_sub=f"a-{unique_suffix}")
    f.add_membership(db_session, school=school, user=admin, role_codes=["school_admin"])
    guardian = f.create_user(db_session, display_name="Tutor", cognito_sub=f"g-{unique_suffix}")
    f.add_membership(db_session, school=school, user=guardian, role_codes=["guardian"])
    db_session.commit()

    headers = f.auth_headers(admin, school_id=school.id)
    resp = client.post(
        f"/api/v1/courses/{structure['course'].id}/teachers",
        headers=headers,
        json={"teacher_user_id": str(guardian.id)},
    )
    assert resp.status_code == 422


def test_archived_course_blocks_new_enrollments_and_assignments(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)
    admin = f.create_user(db_session, display_name="Admin", cognito_sub=f"a-{unique_suffix}")
    f.add_membership(db_session, school=school, user=admin, role_codes=["school_admin"])
    teacher = f.create_user(db_session, display_name="Docente", cognito_sub=f"t-{unique_suffix}")
    f.add_membership(db_session, school=school, user=teacher, role_codes=["teacher"])
    f.assign_teacher(db_session, school=school, course=structure["course"], teacher_user=teacher)
    db_session.commit()

    admin_headers = f.auth_headers(admin, school_id=school.id)
    archive_resp = client.post(
        f"/api/v1/courses/{structure['course'].id}/archive", headers=admin_headers
    )
    assert archive_resp.status_code == 200

    from app.modules.identity.models import StudentProfile

    profile = StudentProfile(
        school_id=school.id, user_id=None, student_number=f"S-{unique_suffix}"
    )
    db_session.add(profile)
    db_session.commit()

    enrollment_resp = client.post(
        "/api/v1/enrollments",
        headers=admin_headers,
        json={
            "academic_year_id": str(structure["year"].id),
            "student_id": str(profile.id),
            "section_id": str(structure["section"].id),
            "starts_on": "2026-01-15",
            "course_ids": [str(structure["course"].id)],
        },
    )
    assert enrollment_resp.status_code == 422

    teacher_headers = f.auth_headers(teacher, school_id=school.id)
    assignment_resp = client.post(
        f"/api/v1/courses/{structure['course'].id}/assignments",
        headers=teacher_headers,
        json={
            "title": "Tarea nueva",
            "instructions": "",
            "due_at": "2026-12-01T00:00:00+00:00",
            "max_score": "100",
            "allow_late": False,
        },
    )
    assert assignment_resp.status_code == 422

    # El docente sigue pudiendo ver el curso archivado (historial), solo no puede
    # crear contenido nuevo en él.
    course_resp = client.get(
        f"/api/v1/courses/{structure['course'].id}", headers=teacher_headers
    )
    assert course_resp.status_code == 200
