"""E2E real vía HTTP: docente -> tarea -> alumno -> entrega -> consulta de padre
(sección 19, punto 12, adaptado al alcance de esta entrega: sin notas todavía)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

from tests import factories as f


def test_full_vertical_slice(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")

    admin = f.create_user(db_session, display_name="Admin", cognito_sub=f"adm-{unique_suffix}")
    teacher = f.create_user(db_session, display_name="Docente", cognito_sub=f"doc-{unique_suffix}")
    student_user = f.create_user(db_session, display_name="Alumno", cognito_sub=f"alu-{unique_suffix}")
    guardian = f.create_user(db_session, display_name="Tutor", cognito_sub=f"tut-{unique_suffix}")

    f.add_membership(db_session, school=school, user=admin, role_codes=["school_admin"])
    f.add_membership(db_session, school=school, user=teacher, role_codes=["teacher"])
    f.add_membership(db_session, school=school, user=student_user, role_codes=["student"])
    f.add_membership(db_session, school=school, user=guardian, role_codes=["guardian"])
    db_session.commit()

    admin_headers = f.auth_headers(admin, school_id=school.id)

    year_resp = client.post(
        "/api/v1/academic-years",
        headers=admin_headers,
        json={"label": "2026", "starts_on": "2026-01-01", "ends_on": "2026-11-30"},
    )
    assert year_resp.status_code == 200, year_resp.text
    year_id = year_resp.json()["id"]

    grade_resp = client.post(
        "/api/v1/grade-levels", headers=admin_headers, json={"name": "Primero", "sort_order": 1}
    )
    assert grade_resp.status_code == 200
    grade_id = grade_resp.json()["id"]

    section_resp = client.post(
        "/api/v1/sections",
        headers=admin_headers,
        json={"academic_year_id": year_id, "grade_level_id": grade_id, "name": "A"},
    )
    assert section_resp.status_code == 200
    section_id = section_resp.json()["id"]

    subject_resp = client.post(
        "/api/v1/subjects", headers=admin_headers, json={"code": "MAT", "name": "Matemática"}
    )
    assert subject_resp.status_code == 200
    subject_id = subject_resp.json()["id"]

    course_resp = client.post(
        "/api/v1/courses",
        headers=admin_headers,
        json={"section_id": section_id, "subject_id": subject_id, "academic_year_id": year_id},
    )
    assert course_resp.status_code == 200
    course_id = course_resp.json()["id"]

    teacher_resp = client.post(
        f"/api/v1/courses/{course_id}/teachers",
        headers=admin_headers,
        json={"teacher_user_id": str(teacher.id)},
    )
    assert teacher_resp.status_code == 200

    # Matrícula: crea perfil de alumno directamente (users:manage/onboarding no es
    # parte de esta entrega vertical) y matricula vía API.
    from app.modules.identity.models import StudentProfile

    profile = StudentProfile(
        school_id=school.id, user_id=student_user.id, student_number=f"S-{unique_suffix}"
    )
    db_session.add(profile)
    db_session.commit()

    enrollment_resp = client.post(
        "/api/v1/enrollments",
        headers=admin_headers,
        json={
            "academic_year_id": year_id,
            "student_id": str(profile.id),
            "section_id": section_id,
            "starts_on": "2026-01-15",
            "course_ids": [course_id],
        },
    )
    assert enrollment_resp.status_code == 200, enrollment_resp.text

    f.link_guardian(db_session, school=school, guardian_user=guardian, student_profile=profile)
    db_session.commit()

    teacher_headers = f.auth_headers(teacher, school_id=school.id)
    assignment_resp = client.post(
        f"/api/v1/courses/{course_id}/assignments",
        headers=teacher_headers,
        json={
            "title": "Tarea 1",
            "instructions": "Resuelve los ejercicios.",
            "due_at": (datetime.now(UTC) + timedelta(days=3)).isoformat(),
            "max_score": "100",
            "allow_late": False,
        },
    )
    assert assignment_resp.status_code == 200, assignment_resp.text
    assignment_id = assignment_resp.json()["id"]
    assert assignment_resp.json()["status"] == "draft"

    student_headers = f.auth_headers(student_user, school_id=school.id)
    # Alumno no ve tareas en borrador.
    list_before_publish = client.get(
        f"/api/v1/courses/{course_id}/assignments", headers=student_headers
    )
    assert list_before_publish.json() == []

    publish_resp = client.post(
        f"/api/v1/assignments/{assignment_id}/publish", headers=teacher_headers
    )
    assert publish_resp.status_code == 200
    assert publish_resp.json()["status"] == "published"

    list_after_publish = client.get(
        f"/api/v1/courses/{course_id}/assignments", headers=student_headers
    )
    assert len(list_after_publish.json()) == 1

    draft_resp = client.put(
        f"/api/v1/assignments/{assignment_id}/my-submission",
        headers=student_headers,
        json={"body": "Mi borrador", "version": 0},
    )
    assert draft_resp.status_code == 200, draft_resp.text
    assert draft_resp.json()["status"] == "draft"
    assert draft_resp.json()["version"] == 1

    # Conflicto de versión optimista.
    stale_resp = client.put(
        f"/api/v1/assignments/{assignment_id}/my-submission",
        headers=student_headers,
        json={"body": "Otro borrador desactualizado", "version": 0},
    )
    assert stale_resp.status_code == 409

    submit_resp = client.post(
        f"/api/v1/assignments/{assignment_id}/my-submission/submit",
        headers=student_headers,
        json={"body": "Entrega final", "version": 1},
    )
    assert submit_resp.status_code == 200, submit_resp.text
    assert submit_resp.json()["status"] == "submitted"
    assert submit_resp.json()["late"] is False

    # Retry de submit es idempotente (devuelve el resultado existente).
    retry_resp = client.post(
        f"/api/v1/assignments/{assignment_id}/my-submission/submit",
        headers=student_headers,
        json={"body": "Otra vez", "version": 2},
    )
    assert retry_resp.status_code == 200
    assert retry_resp.json()["status"] == "submitted"

    guardian_headers = f.auth_headers(guardian, school_id=school.id)
    guardian_view = client.get(
        f"/api/v1/students/{profile.id}/submissions", headers=guardian_headers
    )
    assert guardian_view.status_code == 200
    assert len(guardian_view.json()) == 1
    assert guardian_view.json()[0]["status"] == "submitted"

    # El docente ve todas las entregas de la tarea.
    teacher_view = client.get(
        f"/api/v1/assignments/{assignment_id}/submissions", headers=teacher_headers
    )
    assert teacher_view.status_code == 200
    assert len(teacher_view.json()) == 1


def test_late_submission_rejected_when_not_allowed(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)
    student_user = f.create_user(db_session, display_name="Alumno", cognito_sub=f"al-{unique_suffix}")
    f.add_membership(db_session, school=school, user=student_user, role_codes=["student"])
    f.enroll_student(
        db_session,
        school=school,
        structure=structure,
        student_user=student_user,
        student_number=f"L-{unique_suffix}",
    )
    from app.modules.learning.models import Assignment

    assignment = Assignment(
        school_id=school.id,
        course_id=structure["course"].id,
        title="Tarea vencida",
        instructions="",
        due_at=datetime.now(UTC) - timedelta(days=1),
        max_score=100,
        status="published",
        allow_late=False,
    )
    db_session.add(assignment)
    db_session.commit()

    headers = f.auth_headers(student_user, school_id=school.id)
    resp = client.post(
        f"/api/v1/assignments/{assignment.id}/my-submission/submit",
        headers=headers,
        json={"body": "Tarde", "version": 0},
    )
    assert resp.status_code == 409
