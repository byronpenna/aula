"""Modalidad del curso (virtual/presencial/mixto) y horario de clases
presencial: el horario se administra con academics:manage (igual que
fechas/sección/materia del curso), pero verlo alcanza con course:read —
cualquiera con acceso al curso (alumno/tutor incluidos), igual criterio que
calendar-events, para que el frontend lo combine en el calendario del alumno."""

from __future__ import annotations

from tests import factories as f


def test_course_defaults_to_virtual_modality(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)
    admin = f.create_user(db_session, display_name="Admin", cognito_sub=f"a-{unique_suffix}")
    f.add_membership(db_session, school=school, user=admin, role_codes=["school_admin"])
    db_session.commit()

    headers = f.auth_headers(admin, school_id=school.id)
    resp = client.get(f"/api/v1/courses/{structure['course'].id}", headers=headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["modality"] == "virtual"


def test_admin_sets_modality_and_schedule(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)
    admin = f.create_user(db_session, display_name="Admin", cognito_sub=f"a-{unique_suffix}")
    f.add_membership(db_session, school=school, user=admin, role_codes=["school_admin"])
    db_session.commit()

    headers = f.auth_headers(admin, school_id=school.id)
    course_id = structure["course"].id

    update_resp = client.patch(
        f"/api/v1/courses/{course_id}", headers=headers, json={"modality": "presencial"}
    )
    assert update_resp.status_code == 200, update_resp.text
    assert update_resp.json()["modality"] == "presencial"

    set_resp = client.put(
        f"/api/v1/courses/{course_id}/schedule",
        headers=headers,
        json={
            "slots": [
                {"weekday": 0, "start_time": "07:00", "end_time": "08:30", "location": "Aula 3"},
                {"weekday": 2, "start_time": "07:00", "end_time": "08:30"},
            ]
        },
    )
    assert set_resp.status_code == 200, set_resp.text
    slots = set_resp.json()
    assert len(slots) == 2
    assert slots[0]["weekday"] == 0
    assert slots[0]["location"] == "Aula 3"
    assert slots[1]["location"] is None

    list_resp = client.get(f"/api/v1/courses/{course_id}/schedule", headers=headers)
    assert list_resp.status_code == 200, list_resp.text
    assert len(list_resp.json()) == 2

    # Reemplazar el horario borra las franjas anteriores (nunca merge parcial).
    replace_resp = client.put(
        f"/api/v1/courses/{course_id}/schedule",
        headers=headers,
        json={"slots": [{"weekday": 4, "start_time": "09:00", "end_time": "10:00"}]},
    )
    assert replace_resp.status_code == 200, replace_resp.text
    final_list = client.get(f"/api/v1/courses/{course_id}/schedule", headers=headers)
    assert len(final_list.json()) == 1
    assert final_list.json()[0]["weekday"] == 4


def test_virtual_course_rejects_schedule(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)
    admin = f.create_user(db_session, display_name="Admin", cognito_sub=f"a-{unique_suffix}")
    f.add_membership(db_session, school=school, user=admin, role_codes=["school_admin"])
    db_session.commit()

    headers = f.auth_headers(admin, school_id=school.id)
    resp = client.put(
        f"/api/v1/courses/{structure['course'].id}/schedule",
        headers=headers,
        json={"slots": [{"weekday": 0, "start_time": "07:00", "end_time": "08:30"}]},
    )
    assert resp.status_code == 422, resp.text


def test_schedule_rejects_invalid_weekday_and_time_order(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)
    admin = f.create_user(db_session, display_name="Admin", cognito_sub=f"a-{unique_suffix}")
    f.add_membership(db_session, school=school, user=admin, role_codes=["school_admin"])
    db_session.commit()
    headers = f.auth_headers(admin, school_id=school.id)
    course_id = structure["course"].id
    client.patch(f"/api/v1/courses/{course_id}", headers=headers, json={"modality": "mixto"})

    bad_weekday = client.put(
        f"/api/v1/courses/{course_id}/schedule",
        headers=headers,
        json={"slots": [{"weekday": 9, "start_time": "07:00", "end_time": "08:30"}]},
    )
    assert bad_weekday.status_code == 422, bad_weekday.text

    bad_order = client.put(
        f"/api/v1/courses/{course_id}/schedule",
        headers=headers,
        json={"slots": [{"weekday": 0, "start_time": "08:30", "end_time": "07:00"}]},
    )
    assert bad_order.status_code == 422, bad_order.text


def test_teacher_cannot_set_schedule_but_student_can_read_it(db_session, client, unique_suffix):
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
    f.enroll_student(
        db_session,
        school=school,
        structure=structure,
        student_user=student_user,
        student_number=f"ST-{unique_suffix}",
    )
    db_session.commit()

    admin_headers = f.auth_headers(admin, school_id=school.id)
    course_id = structure["course"].id
    client.patch(f"/api/v1/courses/{course_id}", headers=admin_headers, json={"modality": "presencial"})
    client.put(
        f"/api/v1/courses/{course_id}/schedule",
        headers=admin_headers,
        json={"slots": [{"weekday": 1, "start_time": "10:00", "end_time": "11:00"}]},
    )

    teacher_headers = f.auth_headers(teacher, school_id=school.id)
    teacher_set = client.put(
        f"/api/v1/courses/{course_id}/schedule",
        headers=teacher_headers,
        json={"slots": []},
    )
    assert teacher_set.status_code == 403, teacher_set.text

    student_headers = f.auth_headers(student_user, school_id=school.id)
    student_read = client.get(f"/api/v1/courses/{course_id}/schedule", headers=student_headers)
    assert student_read.status_code == 200, student_read.text
    assert len(student_read.json()) == 1
    assert student_read.json()[0]["weekday"] == 1
