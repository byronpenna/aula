"""Secciones de recursos (PDFs) por curso: crear/renombrar/eliminar es acción de
quien administra el curso puntual (admin/coordinación, o el docente asignado a
ese curso — academics/service.py::require_course_staff_access); ver los recursos
alcanza con course:read (cualquier rol con acceso al curso). Eliminar una sección
es baja lógica: sus PDFs nunca se borran, pasan a verse como "sin sección"
(learning_service.get_course_resources)."""

from __future__ import annotations

import base64

from tests import factories as f

PDF_BYTES = b"%PDF-1.4 fake pdf content"


def _upload(client, headers, section_id, *, filename="guia.pdf", content_type="application/pdf"):
    return client.post(
        f"/api/v1/resource-sections/{section_id}/files",
        headers=headers,
        files={"upload": (filename, PDF_BYTES, content_type)},
    )


def test_admin_creates_section_uploads_pdf_and_renames(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)
    admin = f.create_user(db_session, display_name="Admin", cognito_sub=f"a-{unique_suffix}")
    f.add_membership(db_session, school=school, user=admin, role_codes=["school_admin"])
    db_session.commit()

    headers = f.auth_headers(admin, school_id=school.id)
    course_id = structure["course"].id

    create_resp = client.post(
        f"/api/v1/courses/{course_id}/resource-sections", headers=headers, json={"name": "  Guías  "}
    )
    assert create_resp.status_code == 200, create_resp.text
    section_id = create_resp.json()["id"]
    assert create_resp.json()["name"] == "Guías"
    assert create_resp.json()["status"] == "active"

    upload_resp = _upload(client, headers, section_id)
    assert upload_resp.status_code == 200, upload_resp.text
    assert upload_resp.json()["content_type"] == "application/pdf"
    file_id = upload_resp.json()["id"]

    resources_resp = client.get(f"/api/v1/courses/{course_id}/resource-sections", headers=headers)
    assert resources_resp.status_code == 200, resources_resp.text
    body = resources_resp.json()
    assert len(body["sections"]) == 1
    assert body["sections"][0]["name"] == "Guías"
    assert len(body["sections"][0]["files"]) == 1
    assert body["sections"][0]["files"][0]["id"] == file_id
    assert body["unsectioned_files"] == []

    rename_resp = client.patch(
        f"/api/v1/resource-sections/{section_id}", headers=headers, json={"name": "Guías de estudio"}
    )
    assert rename_resp.status_code == 200, rename_resp.text
    assert rename_resp.json()["name"] == "Guías de estudio"

    download_resp = client.get(f"/api/v1/files/{file_id}/download", headers=headers)
    assert download_resp.status_code == 200, download_resp.text
    assert base64.b64decode(download_resp.json()["content_base64"]) == PDF_BYTES


def test_delete_section_keeps_pdf_as_unsectioned(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)
    admin = f.create_user(db_session, display_name="Admin", cognito_sub=f"a-{unique_suffix}")
    f.add_membership(db_session, school=school, user=admin, role_codes=["school_admin"])
    db_session.commit()

    headers = f.auth_headers(admin, school_id=school.id)
    course_id = structure["course"].id

    section_id = client.post(
        f"/api/v1/courses/{course_id}/resource-sections", headers=headers, json={"name": "Temporal"}
    ).json()["id"]
    file_id = _upload(client, headers, section_id).json()["id"]

    delete_resp = client.delete(f"/api/v1/resource-sections/{section_id}", headers=headers)
    assert delete_resp.status_code == 200, delete_resp.text
    assert delete_resp.json()["status"] == "deleted"

    resources_resp = client.get(f"/api/v1/courses/{course_id}/resource-sections", headers=headers)
    body = resources_resp.json()
    assert body["sections"] == []
    assert len(body["unsectioned_files"]) == 1
    assert body["unsectioned_files"][0]["id"] == file_id

    # El PDF sigue siendo descargable aunque su sección ya esté eliminada.
    download_resp = client.get(f"/api/v1/files/{file_id}/download", headers=headers)
    assert download_resp.status_code == 200, download_resp.text

    # Eliminar de nuevo (ya eliminada) no falla ni duplica el audit log.
    repeat_delete = client.delete(f"/api/v1/resource-sections/{section_id}", headers=headers)
    assert repeat_delete.status_code == 200


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
    db_session.commit()

    course_id = structure["course"].id
    teacher_headers = f.auth_headers(teacher, school_id=school.id)

    create_resp = client.post(
        f"/api/v1/courses/{course_id}/resource-sections",
        headers=teacher_headers,
        json={"name": "Material del docente"},
    )
    assert create_resp.status_code == 200, create_resp.text
    section_id = create_resp.json()["id"]

    upload_resp = _upload(client, teacher_headers, section_id)
    assert upload_resp.status_code == 200, upload_resp.text

    other_headers = f.auth_headers(other_teacher, school_id=school.id)
    forbidden_create = client.post(
        f"/api/v1/courses/{course_id}/resource-sections", headers=other_headers, json={"name": "x"}
    )
    assert forbidden_create.status_code == 403

    forbidden_rename = client.patch(
        f"/api/v1/resource-sections/{section_id}", headers=other_headers, json={"name": "x"}
    )
    assert forbidden_rename.status_code == 403

    forbidden_upload = _upload(client, other_headers, section_id)
    assert forbidden_upload.status_code == 403

    forbidden_delete = client.delete(f"/api/v1/resource-sections/{section_id}", headers=other_headers)
    assert forbidden_delete.status_code == 403


def test_student_and_guardian_can_view_but_not_manage(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)
    admin = f.create_user(db_session, display_name="Admin", cognito_sub=f"a-{unique_suffix}")
    f.add_membership(db_session, school=school, user=admin, role_codes=["school_admin"])
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
    f.link_guardian(
        db_session, school=school, guardian_user=guardian, student_profile=enrolled["profile"]
    )
    db_session.commit()

    admin_headers = f.auth_headers(admin, school_id=school.id)
    course_id = structure["course"].id
    section_id = client.post(
        f"/api/v1/courses/{course_id}/resource-sections", headers=admin_headers, json={"name": "Guías"}
    ).json()["id"]
    _upload(client, admin_headers, section_id)

    student_headers = f.auth_headers(student_user, school_id=school.id)
    view_resp = client.get(f"/api/v1/courses/{course_id}/resource-sections", headers=student_headers)
    assert view_resp.status_code == 200, view_resp.text
    assert len(view_resp.json()["sections"]) == 1
    assert len(view_resp.json()["sections"][0]["files"]) == 1

    guardian_headers = f.auth_headers(guardian, school_id=school.id)
    guardian_view = client.get(f"/api/v1/courses/{course_id}/resource-sections", headers=guardian_headers)
    assert guardian_view.status_code == 200, guardian_view.text
    assert len(guardian_view.json()["sections"]) == 1

    forbidden_create = client.post(
        f"/api/v1/courses/{course_id}/resource-sections", headers=student_headers, json={"name": "x"}
    )
    assert forbidden_create.status_code == 403

    forbidden_upload = _upload(client, student_headers, section_id)
    assert forbidden_upload.status_code == 403

    forbidden_delete = client.delete(f"/api/v1/resource-sections/{section_id}", headers=student_headers)
    assert forbidden_delete.status_code == 403


def test_upload_rejects_non_pdf_content_type(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)
    admin = f.create_user(db_session, display_name="Admin", cognito_sub=f"a-{unique_suffix}")
    f.add_membership(db_session, school=school, user=admin, role_codes=["school_admin"])
    db_session.commit()

    headers = f.auth_headers(admin, school_id=school.id)
    course_id = structure["course"].id
    section_id = client.post(
        f"/api/v1/courses/{course_id}/resource-sections", headers=headers, json={"name": "Guías"}
    ).json()["id"]

    resp = _upload(client, headers, section_id, filename="foto.png", content_type="image/png")
    assert resp.status_code == 422


def test_create_section_rejects_empty_name_and_archived_course(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)
    admin = f.create_user(db_session, display_name="Admin", cognito_sub=f"a-{unique_suffix}")
    f.add_membership(db_session, school=school, user=admin, role_codes=["school_admin"])
    db_session.commit()

    headers = f.auth_headers(admin, school_id=school.id)
    course_id = structure["course"].id

    empty_name_resp = client.post(
        f"/api/v1/courses/{course_id}/resource-sections", headers=headers, json={"name": "   "}
    )
    assert empty_name_resp.status_code == 422

    client.post(f"/api/v1/courses/{course_id}/archive", headers=headers)
    archived_resp = client.post(
        f"/api/v1/courses/{course_id}/resource-sections", headers=headers, json={"name": "Guías"}
    )
    assert archived_resp.status_code == 422
