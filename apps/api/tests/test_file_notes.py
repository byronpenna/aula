"""Notas sobre PDFs de recursos del curso: ver el PDF alcanza con course:read
(cualquier rol con acceso al curso, igual que get_download); crear o borrar una
nota exige administrar el curso (admin/coordinación, o el docente asignado a ese
curso — academics/service.py::require_course_staff_access), igual criterio que
crear/renombrar/eliminar una sección de recursos (ver test_course_resources.py)."""

from __future__ import annotations

from tests import factories as f

PDF_BYTES = b"%PDF-1.4 fake pdf content"


def _create_section_and_file(client, headers, course_id):
    section_id = client.post(
        f"/api/v1/courses/{course_id}/resource-sections", headers=headers, json={"name": "Guías"}
    ).json()["id"]
    file_id = client.post(
        f"/api/v1/resource-sections/{section_id}/files",
        headers=headers,
        files={"upload": ("guia.pdf", PDF_BYTES, "application/pdf")},
    ).json()["id"]
    return section_id, file_id


def test_teacher_creates_page_and_pinned_notes_student_can_read_not_write(
    db_session, client, unique_suffix
):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)
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
        student_number=f"N-{unique_suffix}",
    )
    db_session.commit()

    teacher_headers = f.auth_headers(teacher, school_id=school.id)
    course_id = structure["course"].id
    _section_id, file_id = _create_section_and_file(client, teacher_headers, course_id)

    page_note_resp = client.post(
        f"/api/v1/files/{file_id}/notes",
        headers=teacher_headers,
        json={"page_number": 1, "body": "Lean esta página con cuidado."},
    )
    assert page_note_resp.status_code == 200, page_note_resp.text
    page_note = page_note_resp.json()
    assert page_note["x"] is None and page_note["y"] is None
    assert page_note["author_name"] == "Docente"

    pin_note_resp = client.post(
        f"/api/v1/files/{file_id}/notes",
        headers=teacher_headers,
        json={"page_number": 1, "body": "Aquí va la fórmula.", "x": 0.5, "y": 0.3},
    )
    assert pin_note_resp.status_code == 200, pin_note_resp.text
    pin_note = pin_note_resp.json()
    assert pin_note["x"] == 0.5 and pin_note["y"] == 0.3

    student_headers = f.auth_headers(student_user, school_id=school.id)
    list_resp = client.get(f"/api/v1/files/{file_id}/notes", headers=student_headers)
    assert list_resp.status_code == 200, list_resp.text
    assert len(list_resp.json()) == 2

    forbidden_create = client.post(
        f"/api/v1/files/{file_id}/notes",
        headers=student_headers,
        json={"page_number": 1, "body": "intento de alumno"},
    )
    assert forbidden_create.status_code == 403

    forbidden_delete = client.delete(
        f"/api/v1/file-notes/{page_note['id']}", headers=student_headers
    )
    assert forbidden_delete.status_code == 403

    delete_resp = client.delete(f"/api/v1/file-notes/{page_note['id']}", headers=teacher_headers)
    assert delete_resp.status_code == 204

    after_delete = client.get(f"/api/v1/files/{file_id}/notes", headers=teacher_headers)
    assert len(after_delete.json()) == 1
    assert after_delete.json()[0]["id"] == pin_note["id"]


def test_create_note_validates_input(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)
    admin = f.create_user(db_session, display_name="Admin", cognito_sub=f"a-{unique_suffix}")
    f.add_membership(db_session, school=school, user=admin, role_codes=["school_admin"])
    db_session.commit()

    headers = f.auth_headers(admin, school_id=school.id)
    course_id = structure["course"].id
    _section_id, file_id = _create_section_and_file(client, headers, course_id)

    empty_body = client.post(
        f"/api/v1/files/{file_id}/notes", headers=headers, json={"page_number": 1, "body": "   "}
    )
    assert empty_body.status_code == 422

    bad_page = client.post(
        f"/api/v1/files/{file_id}/notes", headers=headers, json={"page_number": 0, "body": "x"}
    )
    assert bad_page.status_code == 422

    half_pin = client.post(
        f"/api/v1/files/{file_id}/notes",
        headers=headers,
        json={"page_number": 1, "body": "x", "x": 0.5},
    )
    assert half_pin.status_code == 422

    out_of_range = client.post(
        f"/api/v1/files/{file_id}/notes",
        headers=headers,
        json={"page_number": 1, "body": "x", "x": 1.5, "y": 0.5},
    )
    assert out_of_range.status_code == 422


def test_other_teacher_cannot_manage_notes_but_can_read(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)
    teacher = f.create_user(db_session, display_name="Titular", cognito_sub=f"t-{unique_suffix}")
    f.add_membership(db_session, school=school, user=teacher, role_codes=["teacher"])
    f.assign_teacher(db_session, school=school, course=structure["course"], teacher_user=teacher)
    other_teacher = f.create_user(db_session, display_name="Otro", cognito_sub=f"ot-{unique_suffix}")
    f.add_membership(db_session, school=school, user=other_teacher, role_codes=["teacher"])
    db_session.commit()

    teacher_headers = f.auth_headers(teacher, school_id=school.id)
    course_id = structure["course"].id
    _section_id, file_id = _create_section_and_file(client, teacher_headers, course_id)
    note_id = client.post(
        f"/api/v1/files/{file_id}/notes", headers=teacher_headers, json={"page_number": 1, "body": "x"}
    ).json()["id"]

    other_headers = f.auth_headers(other_teacher, school_id=school.id)
    forbidden_create = client.post(
        f"/api/v1/files/{file_id}/notes", headers=other_headers, json={"page_number": 1, "body": "y"}
    )
    assert forbidden_create.status_code == 403

    forbidden_delete = client.delete(f"/api/v1/file-notes/{note_id}", headers=other_headers)
    assert forbidden_delete.status_code == 403
