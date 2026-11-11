"""Gestión de tutores (Administración > Tutores): ficha de contacto propia
del tutor (`GuardianProfile`), independiente de si tiene cuenta de acceso —
mismo criterio que `StudentProfile`. `GuardianStudentLink` ya no apunta a un
`User` directamente sino a este perfil (ver la migración `7c3f9a2e1b4d` y el
comentario en identity/models.py::GuardianProfile)."""

from __future__ import annotations

import uuid

from tests import factories as f

PNG_BYTES = b"\x89PNG\r\n\x1a\n fake png content"


def _admin(db_session, school, unique_suffix):
    admin = f.create_user(db_session, display_name="Admin", cognito_sub=f"a-{unique_suffix}")
    f.add_membership(db_session, school=school, user=admin, role_codes=["school_admin"])
    db_session.commit()
    return admin


def test_create_guardian_profile_minimal_and_full(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    admin = _admin(db_session, school, unique_suffix)
    headers = f.auth_headers(admin, school_id=school.id)

    minimal = client.post("/api/v1/guardians", headers=headers, json={"full_name": "Solo Nombre"})
    assert minimal.status_code == 200, minimal.text
    body = minimal.json()
    assert body["full_name"] == "Solo Nombre"
    assert body["email"] is None
    assert body["phone"] is None
    assert body["students"] == []

    full = client.post(
        "/api/v1/guardians",
        headers=headers,
        json={
            "full_name": "Tutor Completo",
            "email": "tutor@example.com",
            "phone": "+50370001111",
            "profession": "Ingeniera",
            "workplace": "ACME",
            "national_id": "01234567-8",
            "address": "Calle Falsa 123",
            "notes": "Prefiere que lo llamen después de las 5pm.",
        },
    )
    assert full.status_code == 200, full.text
    full_body = full.json()
    for field, value in [
        ("email", "tutor@example.com"),
        ("phone", "+50370001111"),
        ("profession", "Ingeniera"),
        ("workplace", "ACME"),
        ("national_id", "01234567-8"),
        ("address", "Calle Falsa 123"),
        ("notes", "Prefiere que lo llamen después de las 5pm."),
    ]:
        assert full_body[field] == value

    listing = client.get("/api/v1/guardians", headers=headers)
    assert listing.status_code == 200
    assert {g["full_name"] for g in listing.json()} == {"Solo Nombre", "Tutor Completo"}


def test_create_guardian_profile_rejects_empty_name(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    admin = _admin(db_session, school, unique_suffix)
    headers = f.auth_headers(admin, school_id=school.id)

    resp = client.post("/api/v1/guardians", headers=headers, json={"full_name": "   "})
    assert resp.status_code == 422


def test_update_guardian_profile_and_link_account(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    admin = _admin(db_session, school, unique_suffix)
    headers = f.auth_headers(admin, school_id=school.id)

    guardian_id = client.post(
        "/api/v1/guardians", headers=headers, json={"full_name": "Tutor"}
    ).json()["id"]

    update = client.patch(
        f"/api/v1/guardians/{guardian_id}",
        headers=headers,
        json={"phone": "+50370002222", "profession": "Doctora"},
    )
    assert update.status_code == 200, update.text
    assert update.json()["phone"] == "+50370002222"
    assert update.json()["profession"] == "Doctora"
    assert update.json()["full_name"] == "Tutor"

    account = f.create_user(
        db_session, display_name="Cuenta Tutor", cognito_sub=f"gu-{unique_suffix}"
    )
    f.add_membership(db_session, school=school, user=account, role_codes=["guardian"])
    db_session.commit()

    link_account = client.patch(
        f"/api/v1/guardians/{guardian_id}", headers=headers, json={"user_id": str(account.id)}
    )
    assert link_account.status_code == 200, link_account.text
    assert link_account.json()["user_id"] == str(account.id)

    other_guardian_id = client.post(
        "/api/v1/guardians", headers=headers, json={"full_name": "Otro Tutor"}
    ).json()["id"]
    conflict = client.patch(
        f"/api/v1/guardians/{other_guardian_id}",
        headers=headers,
        json={"user_id": str(account.id)},
    )
    assert conflict.status_code == 409

    unknown_user = client.patch(
        f"/api/v1/guardians/{other_guardian_id}",
        headers=headers,
        json={"user_id": str(uuid.uuid4())},
    )
    assert unknown_user.status_code == 404


def test_guardian_profile_not_found(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    admin = _admin(db_session, school, unique_suffix)
    headers = f.auth_headers(admin, school_id=school.id)

    missing_id = uuid.uuid4()
    assert client.get(f"/api/v1/guardians/{missing_id}", headers=headers).status_code == 404
    assert (
        client.patch(
            f"/api/v1/guardians/{missing_id}", headers=headers, json={"phone": "123"}
        ).status_code
        == 404
    )


def test_guardian_endpoints_require_permission(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    admin = _admin(db_session, school, unique_suffix)
    admin_headers = f.auth_headers(admin, school_id=school.id)
    teacher = f.create_user(db_session, display_name="Docente", cognito_sub=f"t-{unique_suffix}")
    f.add_membership(db_session, school=school, user=teacher, role_codes=["teacher"])
    db_session.commit()
    teacher_headers = f.auth_headers(teacher, school_id=school.id)

    guardian_id = client.post(
        "/api/v1/guardians", headers=admin_headers, json={"full_name": "Tutor"}
    ).json()["id"]

    assert client.get("/api/v1/guardians", headers=teacher_headers).status_code == 403
    assert (
        client.post(
            "/api/v1/guardians", headers=teacher_headers, json={"full_name": "Intento"}
        ).status_code
        == 403
    )
    assert client.get(f"/api/v1/guardians/{guardian_id}", headers=teacher_headers).status_code == 403
    assert (
        client.patch(
            f"/api/v1/guardians/{guardian_id}", headers=teacher_headers, json={"phone": "1"}
        ).status_code
        == 403
    )


def test_guardian_link_groups_by_student_grade(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    admin = _admin(db_session, school, unique_suffix)
    headers = f.auth_headers(admin, school_id=school.id)
    structure = f.create_academic_structure(db_session, school)

    student_user = f.create_user(
        db_session, display_name="Alumno Demo", cognito_sub=f"s-{unique_suffix}"
    )
    f.add_membership(db_session, school=school, user=student_user, role_codes=["student"])
    enrollment = f.enroll_student(
        db_session,
        school=school,
        structure=structure,
        student_user=student_user,
        student_number=f"N-{unique_suffix}",
    )
    db_session.commit()
    student_id = str(enrollment["profile"].id)

    guardian_id = client.post(
        "/api/v1/guardians", headers=headers, json={"full_name": "Tutor Grado"}
    ).json()["id"]

    link = client.post(
        f"/api/v1/students/{student_id}/guardians",
        headers=headers,
        json={"guardian_id": guardian_id, "valid_from": "2026-01-01"},
    )
    assert link.status_code == 200, link.text

    detail = client.get(f"/api/v1/guardians/{guardian_id}", headers=headers)
    assert detail.status_code == 200, detail.text
    students = detail.json()["students"]
    assert len(students) == 1
    assert students[0]["id"] == student_id
    assert students[0]["grade_level_name"] == "Primero"

    listing = client.get("/api/v1/guardians", headers=headers)
    found = next(g for g in listing.json() if g["id"] == guardian_id)
    assert found["students"][0]["grade_level_name"] == "Primero"


def test_guardian_photo_upload_and_rejects_other_types(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    admin = _admin(db_session, school, unique_suffix)
    headers = f.auth_headers(admin, school_id=school.id)
    guardian_id = client.post(
        "/api/v1/guardians", headers=headers, json={"full_name": "Tutor"}
    ).json()["id"]

    image_resp = client.post(
        f"/api/v1/guardians/{guardian_id}/photo",
        headers=headers,
        files={"upload": ("foto.png", PNG_BYTES, "image/png")},
    )
    assert image_resp.status_code == 200, image_resp.text
    assert image_resp.json()["content_type"] == "image/png"

    pdf_resp = client.post(
        f"/api/v1/guardians/{guardian_id}/photo",
        headers=headers,
        files={"upload": ("documento.pdf", b"%PDF-1.4 fake", "application/pdf")},
    )
    assert pdf_resp.status_code == 422

    detail = client.get(f"/api/v1/guardians/{guardian_id}", headers=headers)
    assert detail.json()["photo_file_id"] is not None
