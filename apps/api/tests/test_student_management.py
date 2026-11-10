"""Gestión de alumnos (Administración > Alumnos): editar datos personales y
vincular/cambiar cuenta vía `PATCH /students/{id}`, fijar el `@handle` de otro
usuario como admin, tutores asignados (`GuardianStudentLink`, antes sin ningún
endpoint que los creara) y fotografía del alumno (apoyada en el módulo `files`
existente)."""

from __future__ import annotations

import uuid

from tests import factories as f

PNG_BYTES = b"\x89PNG\r\n\x1a\n fake png content"


def _admin(db_session, school, unique_suffix):
    admin = f.create_user(db_session, display_name="Admin", cognito_sub=f"a-{unique_suffix}")
    f.add_membership(db_session, school=school, user=admin, role_codes=["school_admin"])
    db_session.commit()
    return admin


def test_admin_updates_student_personal_data_and_links_account(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    admin = _admin(db_session, school, unique_suffix)
    headers = f.auth_headers(admin, school_id=school.id)

    created = client.post(
        "/api/v1/students", headers=headers, json={"student_number": f"N-{unique_suffix}"}
    )
    assert created.status_code == 200, created.text
    student_id = created.json()["id"]

    update = client.patch(
        f"/api/v1/students/{student_id}",
        headers=headers,
        json={"first_name": "Ivonne", "last_name": "Pérez", "birth_date": "2015-03-20"},
    )
    assert update.status_code == 200, update.text
    body = update.json()
    assert body["display_name"] == "Ivonne Pérez"
    assert body["birth_date"] == "2015-03-20"
    assert body["user_id"] is None

    account = f.create_user(db_session, display_name="Cuenta Ivonne", cognito_sub=f"iv-{unique_suffix}")
    f.add_membership(db_session, school=school, user=account, role_codes=["student"])
    db_session.commit()

    link = client.patch(
        f"/api/v1/students/{student_id}", headers=headers, json={"user_id": str(account.id)}
    )
    assert link.status_code == 200, link.text
    assert link.json()["user_id"] == str(account.id)
    # El nombre propio del perfil sigue ganando sobre el display_name de la cuenta.
    assert link.json()["display_name"] == "Ivonne Pérez"


def test_update_student_rejects_linking_already_linked_user(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    admin = _admin(db_session, school, unique_suffix)
    headers = f.auth_headers(admin, school_id=school.id)
    account = f.create_user(db_session, display_name="Alumno", cognito_sub=f"s-{unique_suffix}")
    f.add_membership(db_session, school=school, user=account, role_codes=["student"])
    db_session.commit()

    first = client.post(
        "/api/v1/students",
        headers=headers,
        json={"student_number": f"N1-{unique_suffix}", "user_id": str(account.id)},
    )
    assert first.status_code == 200, first.text

    second = client.post(
        "/api/v1/students", headers=headers, json={"student_number": f"N2-{unique_suffix}"}
    )
    assert second.status_code == 200, second.text

    relink = client.patch(
        f"/api/v1/students/{second.json()['id']}",
        headers=headers,
        json={"user_id": str(account.id)},
    )
    assert relink.status_code == 409


def test_admin_sets_handle_of_another_user(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    admin = _admin(db_session, school, unique_suffix)
    headers = f.auth_headers(admin, school_id=school.id)
    student_user = f.create_user(
        db_session, display_name="Alumno", cognito_sub=f"s-{unique_suffix}"
    )
    f.add_membership(db_session, school=school, user=student_user, role_codes=["student"])
    db_session.commit()

    resp = client.patch(
        f"/api/v1/users/{student_user.id}",
        headers=headers,
        json={"handle": f"Alumno_{unique_suffix}"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["handle"] == f"alumno_{unique_suffix}".lower()

    invalid = client.patch(
        f"/api/v1/users/{student_user.id}", headers=headers, json={"handle": "a"}
    )
    assert invalid.status_code == 422


def test_guardian_link_create_list_and_revoke(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    admin = _admin(db_session, school, unique_suffix)
    headers = f.auth_headers(admin, school_id=school.id)
    guardian = f.create_user(db_session, display_name="Tutor", cognito_sub=f"g-{unique_suffix}")
    f.add_membership(db_session, school=school, user=guardian, role_codes=["guardian"])
    db_session.commit()

    created = client.post(
        "/api/v1/students", headers=headers, json={"student_number": f"N-{unique_suffix}"}
    )
    student_id = created.json()["id"]

    link = client.post(
        f"/api/v1/students/{student_id}/guardians",
        headers=headers,
        json={
            "guardian_user_id": str(guardian.id),
            "relationship_label": "madre",
            "valid_from": "2026-01-01",
        },
    )
    assert link.status_code == 200, link.text
    assert link.json()["guardian_display_name"] == "Tutor"
    assert link.json()["status"] == "active"
    link_id = link.json()["id"]

    dup = client.post(
        f"/api/v1/students/{student_id}/guardians",
        headers=headers,
        json={"guardian_user_id": str(guardian.id), "valid_from": "2026-01-01"},
    )
    assert dup.status_code == 409

    listing = client.get(f"/api/v1/students/{student_id}/guardians", headers=headers)
    assert listing.status_code == 200
    assert len(listing.json()) == 1

    revoke = client.delete(
        f"/api/v1/students/{student_id}/guardians/{link_id}", headers=headers
    )
    assert revoke.status_code == 200
    assert revoke.json()["status"] == "inactive"

    # Tras revocar, se puede volver a vincular al mismo tutor sin chocar con 409.
    relink = client.post(
        f"/api/v1/students/{student_id}/guardians",
        headers=headers,
        json={"guardian_user_id": str(guardian.id), "valid_from": "2026-02-01"},
    )
    assert relink.status_code == 200, relink.text


def test_guardian_link_requires_permission_and_valid_guardian(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    admin = _admin(db_session, school, unique_suffix)
    headers = f.auth_headers(admin, school_id=school.id)
    teacher = f.create_user(db_session, display_name="Docente", cognito_sub=f"t-{unique_suffix}")
    f.add_membership(db_session, school=school, user=teacher, role_codes=["teacher"])
    db_session.commit()

    created = client.post(
        "/api/v1/students", headers=headers, json={"student_number": f"N-{unique_suffix}"}
    )
    student_id = created.json()["id"]

    forbidden = client.post(
        f"/api/v1/students/{student_id}/guardians",
        headers=f.auth_headers(teacher, school_id=school.id),
        json={"guardian_user_id": str(teacher.id), "valid_from": "2026-01-01"},
    )
    assert forbidden.status_code == 403

    not_found = client.post(
        f"/api/v1/students/{student_id}/guardians",
        headers=headers,
        json={"guardian_user_id": str(uuid.uuid4()), "valid_from": "2026-01-01"},
    )
    assert not_found.status_code == 404


def test_student_photo_upload_and_download(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    admin = _admin(db_session, school, unique_suffix)
    headers = f.auth_headers(admin, school_id=school.id)
    teacher = f.create_user(db_session, display_name="Docente", cognito_sub=f"t-{unique_suffix}")
    f.add_membership(db_session, school=school, user=teacher, role_codes=["teacher"])
    db_session.commit()

    created = client.post(
        "/api/v1/students", headers=headers, json={"student_number": f"N-{unique_suffix}"}
    )
    student_id = created.json()["id"]

    rejected = client.post(
        f"/api/v1/students/{student_id}/photo",
        headers=headers,
        files={"upload": ("foto.pdf", b"%PDF-1.4 not an image", "application/pdf")},
    )
    assert rejected.status_code == 422

    upload = client.post(
        f"/api/v1/students/{student_id}/photo",
        headers=headers,
        files={"upload": ("foto.png", PNG_BYTES, "image/png")},
    )
    assert upload.status_code == 200, upload.text
    file_id = upload.json()["id"]

    # No hay `GET /students/{id}` singular en identity (el detalle vive en
    # academics); se confirma el vínculo a través del listado.
    listing = client.get("/api/v1/students", headers=headers)
    assert any(s["id"] == student_id and s["photo_file_id"] == file_id for s in listing.json())

    download = client.get(f"/api/v1/files/{file_id}/download", headers=headers)
    assert download.status_code == 200, download.text

    forbidden = client.get(
        f"/api/v1/files/{file_id}/download", headers=f.auth_headers(teacher, school_id=school.id)
    )
    assert forbidden.status_code == 403

    forbidden_upload = client.post(
        f"/api/v1/students/{student_id}/photo",
        headers=f.auth_headers(teacher, school_id=school.id),
        files={"upload": ("foto.png", PNG_BYTES, "image/png")},
    )
    assert forbidden_upload.status_code == 403
