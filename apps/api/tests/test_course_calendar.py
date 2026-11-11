"""Calendario de un curso (fechas importantes, sección nueva): verlas alcanza
con course:read (cualquier rol con acceso al curso, alumno/tutor incluidos);
crearlas/quitarlas exige ASSIGNMENT_MANAGE + estar realmente vinculado a ese
curso puntual (admin/coordinación en todo el colegio, o el docente asignado a
este curso — igual criterio que crear una tarea, ver
learning/service.py::create_calendar_event)."""

from __future__ import annotations

from tests import factories as f


def test_teacher_creates_and_lists_calendar_events(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)
    teacher = f.create_user(db_session, display_name="Docente", cognito_sub=f"t-{unique_suffix}")
    f.add_membership(db_session, school=school, user=teacher, role_codes=["teacher"])
    f.assign_teacher(db_session, school=school, course=structure["course"], teacher_user=teacher)
    db_session.commit()

    headers = f.auth_headers(teacher, school_id=school.id)
    course_id = structure["course"].id

    first = client.post(
        f"/api/v1/courses/{course_id}/calendar-events",
        headers=headers,
        json={"title": "Examen parcial", "event_date": "2026-03-15"},
    )
    assert first.status_code == 200, first.text
    assert first.json()["description"] is None

    second = client.post(
        f"/api/v1/courses/{course_id}/calendar-events",
        headers=headers,
        json={
            "title": "Entrega de proyecto",
            "description": "Trae el proyecto impreso y en USB.",
            "event_date": "2026-02-01",
        },
    )
    assert second.status_code == 200, second.text

    list_resp = client.get(f"/api/v1/courses/{course_id}/calendar-events", headers=headers)
    assert list_resp.status_code == 200, list_resp.text
    events = list_resp.json()
    assert len(events) == 2
    # Ordenadas por fecha, no por orden de creación.
    assert [e["title"] for e in events] == ["Entrega de proyecto", "Examen parcial"]
    assert events[0]["description"] == "Trae el proyecto impreso y en USB."


def test_create_calendar_event_rejects_empty_title(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)
    admin = f.create_user(db_session, display_name="Admin", cognito_sub=f"a-{unique_suffix}")
    f.add_membership(db_session, school=school, user=admin, role_codes=["school_admin"])
    db_session.commit()

    headers = f.auth_headers(admin, school_id=school.id)
    resp = client.post(
        f"/api/v1/courses/{structure['course'].id}/calendar-events",
        headers=headers,
        json={"title": "   ", "event_date": "2026-03-15"},
    )
    assert resp.status_code == 422


def test_student_can_list_but_not_create(db_session, client, unique_suffix):
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

    admin_headers = f.auth_headers(admin, school_id=school.id)
    student_headers = f.auth_headers(student_user, school_id=school.id)
    course_id = structure["course"].id

    client.post(
        f"/api/v1/courses/{course_id}/calendar-events",
        headers=admin_headers,
        json={"title": "Día de puertas abiertas", "event_date": "2026-05-10"},
    )

    forbidden = client.post(
        f"/api/v1/courses/{course_id}/calendar-events",
        headers=student_headers,
        json={"title": "Intento de alumno", "event_date": "2026-05-10"},
    )
    assert forbidden.status_code == 403

    student_list = client.get(f"/api/v1/courses/{course_id}/calendar-events", headers=student_headers)
    assert student_list.status_code == 200, student_list.text
    assert len(student_list.json()) == 1
    assert student_list.json()[0]["title"] == "Día de puertas abiertas"


def test_unrelated_teacher_cannot_create_in_another_course(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)
    other_teacher = f.create_user(
        db_session, display_name="Otro Docente", cognito_sub=f"t2-{unique_suffix}"
    )
    f.add_membership(db_session, school=school, user=other_teacher, role_codes=["teacher"])
    db_session.commit()

    other_headers = f.auth_headers(other_teacher, school_id=school.id)
    resp = client.post(
        f"/api/v1/courses/{structure['course'].id}/calendar-events",
        headers=other_headers,
        json={"title": "No debería poder", "event_date": "2026-03-15"},
    )
    assert resp.status_code == 404


def test_delete_calendar_event(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)
    admin = f.create_user(db_session, display_name="Admin", cognito_sub=f"a-{unique_suffix}")
    f.add_membership(db_session, school=school, user=admin, role_codes=["school_admin"])
    db_session.commit()

    headers = f.auth_headers(admin, school_id=school.id)
    course_id = structure["course"].id
    event_id = client.post(
        f"/api/v1/courses/{course_id}/calendar-events",
        headers=headers,
        json={"title": "Receso", "event_date": "2026-04-01"},
    ).json()["id"]

    delete_resp = client.delete(f"/api/v1/calendar-events/{event_id}", headers=headers)
    assert delete_resp.status_code == 204

    list_resp = client.get(f"/api/v1/courses/{course_id}/calendar-events", headers=headers)
    assert list_resp.json() == []
