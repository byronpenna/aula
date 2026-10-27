"""Catálogo de libros digitales y sus compras (módulo nuevo, independiente de
cursos): el catálogo es de lectura abierta, pero el archivo solo lo puede
descargar quien tiene una compra `paid` (colecturía manual o Wompi)."""

from __future__ import annotations

import hashlib

from tests import factories as f


def _setup_school_with_student(db_session, unique_suffix, *, extra_roles=None):
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    admin = f.create_user(db_session, display_name="Admin", cognito_sub=f"a-{unique_suffix}")
    f.add_membership(db_session, school=school, user=admin, role_codes=["school_admin"])
    student_user = f.create_user(db_session, display_name="Alumno", cognito_sub=f"s-{unique_suffix}")
    f.add_membership(db_session, school=school, user=student_user, role_codes=["student"])
    from app.modules.identity.models import StudentProfile

    profile = StudentProfile(
        school_id=school.id, user_id=student_user.id, student_number=f"N-{unique_suffix}"
    )
    db_session.add(profile)
    db_session.flush()
    db_session.commit()
    return school, admin, student_user, profile


def test_catalog_is_open_but_download_requires_colecturia_purchase(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school, admin, student_user, profile = _setup_school_with_student(db_session, unique_suffix)
    admin_headers = f.auth_headers(admin, school_id=school.id)
    student_headers = f.auth_headers(student_user, school_id=school.id)

    create_resp = client.post(
        "/api/v1/books",
        headers=admin_headers,
        json={"title": "Álgebra I", "author": "Autor Demo", "price": "12.50"},
    )
    assert create_resp.status_code == 200, create_resp.text
    book_id = create_resp.json()["id"]
    assert create_resp.json()["status"] == "active"

    upload_resp = client.post(
        f"/api/v1/books/{book_id}/file",
        headers=admin_headers,
        files={"upload": ("algebra.pdf", b"%PDF-1.4 contenido de prueba", "application/pdf")},
    )
    assert upload_resp.status_code == 200, upload_resp.text

    # El catálogo es visible para el alumno aunque no haya comprado nada.
    catalog_resp = client.get("/api/v1/books", headers=student_headers)
    assert catalog_resp.status_code == 200, catalog_resp.text
    assert len(catalog_resp.json()) == 1
    assert catalog_resp.json()[0]["owned"] is False

    # Sin compra, la descarga no revela el libro (404, nunca 403).
    denied_resp = client.get(f"/api/v1/books/{book_id}/download", headers=student_headers)
    assert denied_resp.status_code == 404, denied_resp.text

    # El admin registra la compra por colecturía (ya cobrada, sin aprobación previa).
    purchase_resp = client.post(
        f"/api/v1/books/{book_id}/purchases/colecturia",
        headers=admin_headers,
        json={"student_id": str(profile.id)},
    )
    assert purchase_resp.status_code == 200, purchase_resp.text
    assert purchase_resp.json()["status"] == "paid"
    assert purchase_resp.json()["method"] == "colecturia"

    # Ahora sí puede descargarlo.
    download_resp = client.get(f"/api/v1/books/{book_id}/download", headers=student_headers)
    assert download_resp.status_code == 200, download_resp.text
    assert download_resp.json()["content_base64"] is not None

    my_books_resp = client.get("/api/v1/me/books", headers=student_headers)
    assert my_books_resp.status_code == 200, my_books_resp.text
    assert [b["id"] for b in my_books_resp.json()] == [book_id]


def test_second_student_without_purchase_still_denied(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school, admin, student_user, profile = _setup_school_with_student(db_session, unique_suffix)
    admin_headers = f.auth_headers(admin, school_id=school.id)

    other_student_user = f.create_user(db_session, display_name="Otro Alumno", cognito_sub=f"s2-{unique_suffix}")
    f.add_membership(db_session, school=school, user=other_student_user, role_codes=["student"])
    from app.modules.identity.models import StudentProfile

    other_profile = StudentProfile(
        school_id=school.id, user_id=other_student_user.id, student_number=f"N2-{unique_suffix}"
    )
    db_session.add(other_profile)
    db_session.flush()
    db_session.commit()

    book_id = client.post(
        "/api/v1/books", headers=admin_headers, json={"title": "Geometría", "price": "8.00"}
    ).json()["id"]
    client.post(
        f"/api/v1/books/{book_id}/purchases/colecturia",
        headers=admin_headers,
        json={"student_id": str(profile.id)},
    )

    other_headers = f.auth_headers(other_student_user, school_id=school.id)
    resp = client.get(f"/api/v1/books/{book_id}/download", headers=other_headers)
    assert resp.status_code == 404, resp.text


def test_colecturia_purchase_is_idempotent(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school, admin, student_user, profile = _setup_school_with_student(db_session, unique_suffix)
    admin_headers = f.auth_headers(admin, school_id=school.id)
    book_id = client.post(
        "/api/v1/books", headers=admin_headers, json={"title": "Física", "price": "15.00"}
    ).json()["id"]

    first = client.post(
        f"/api/v1/books/{book_id}/purchases/colecturia",
        headers=admin_headers,
        json={"student_id": str(profile.id)},
    )
    second = client.post(
        f"/api/v1/books/{book_id}/purchases/colecturia",
        headers=admin_headers,
        json={"student_id": str(profile.id)},
    )
    assert first.status_code == 200 and second.status_code == 200
    assert first.json()["id"] == second.json()["id"]

    purchases = client.get(f"/api/v1/books/{book_id}/purchases", headers=admin_headers)
    assert purchases.status_code == 200, purchases.text
    assert len(purchases.json()) == 1


def test_finance_role_can_manage_books_without_enrollment_permission(db_session, client, unique_suffix):
    """`finance` no tiene `enrollment:manage` por defecto (core/permissions.py);
    por eso el picker de alumnos de colecturía usa `books:manage`, no reutiliza
    `GET /students`."""
    f.ensure_role_catalog(db_session)
    school, _admin, student_user, profile = _setup_school_with_student(db_session, unique_suffix)
    finance_user = f.create_user(db_session, display_name="Finanzas", cognito_sub=f"f-{unique_suffix}")
    f.add_membership(db_session, school=school, user=finance_user, role_codes=["finance"])
    db_session.commit()
    finance_headers = f.auth_headers(finance_user, school_id=school.id)

    create_resp = client.post(
        "/api/v1/books", headers=finance_headers, json={"title": "Historia", "price": "9.99"}
    )
    assert create_resp.status_code == 200, create_resp.text
    book_id = create_resp.json()["id"]

    students_resp = client.get("/api/v1/books/students", headers=finance_headers)
    assert students_resp.status_code == 200, students_resp.text
    assert any(row["id"] == str(profile.id) for row in students_resp.json())

    purchase_resp = client.post(
        f"/api/v1/books/{book_id}/purchases/colecturia",
        headers=finance_headers,
        json={"student_id": str(profile.id)},
    )
    assert purchase_resp.status_code == 200, purchase_resp.text


def test_student_cannot_create_book(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school, _admin, student_user, _profile = _setup_school_with_student(db_session, unique_suffix)
    student_headers = f.auth_headers(student_user, school_id=school.id)
    resp = client.post(
        "/api/v1/books", headers=student_headers, json={"title": "No debería poder", "price": "1.00"}
    )
    assert resp.status_code == 403, resp.text


def test_wompi_checkout_and_webhook_confirm_purchase(db_session, client, unique_suffix):
    from app.core.config import get_settings

    settings = get_settings()
    original = (settings.wompi_public_key, settings.wompi_integrity_secret, settings.wompi_events_key)
    settings.wompi_public_key = "pub_test_dummy"
    settings.wompi_integrity_secret = "integrity_test_secret"
    settings.wompi_events_key = "events_test_secret"
    try:
        f.ensure_role_catalog(db_session)
        school, admin, student_user, profile = _setup_school_with_student(db_session, unique_suffix)
        admin_headers = f.auth_headers(admin, school_id=school.id)
        student_headers = f.auth_headers(student_user, school_id=school.id)

        book_id = client.post(
            "/api/v1/books", headers=admin_headers, json={"title": "Química", "price": "20.00"}
        ).json()["id"]
        client.post(
            f"/api/v1/books/{book_id}/file",
            headers=admin_headers,
            files={"upload": ("quimica.pdf", b"%PDF-1.4 contenido", "application/pdf")},
        )

        checkout_resp = client.post(f"/api/v1/books/{book_id}/purchases/wompi", headers=student_headers)
        assert checkout_resp.status_code == 200, checkout_resp.text
        checkout = checkout_resp.json()
        assert checkout["amount_in_cents"] == 2000
        assert checkout["public_key"] == "pub_test_dummy"

        # Todavía pendiente: sin confirmación del webhook, no hay acceso.
        denied = client.get(f"/api/v1/books/{book_id}/download", headers=student_headers)
        assert denied.status_code == 404, denied.text

        reference = checkout["reference"]
        properties = ["transaction.id", "transaction.status", "transaction.reference"]
        data = {
            "transaction": {"id": "wompi-txn-1", "status": "APPROVED", "reference": reference}
        }
        timestamp = "1700000000"
        raw = "".join(str(data["transaction"][p.split(".")[1]]) for p in properties) + timestamp + "events_test_secret"
        checksum = hashlib.sha256(raw.encode("utf-8")).hexdigest()
        webhook_payload = {
            "data": data,
            "timestamp": timestamp,
            "signature": {"checksum": checksum, "properties": properties},
        }

        webhook_resp = client.post("/webhooks/wompi", json=webhook_payload)
        assert webhook_resp.status_code == 204, webhook_resp.text

        allowed = client.get(f"/api/v1/books/{book_id}/download", headers=student_headers)
        assert allowed.status_code == 200, allowed.text

        # Reintento del mismo evento: idempotente, no falla ni duplica.
        webhook_resp_again = client.post("/webhooks/wompi", json=webhook_payload)
        assert webhook_resp_again.status_code == 204, webhook_resp_again.text

        purchases = client.get(f"/api/v1/books/{book_id}/purchases", headers=admin_headers)
        assert len(purchases.json()) == 1
        assert purchases.json()[0]["status"] == "paid"
    finally:
        settings.wompi_public_key, settings.wompi_integrity_secret, settings.wompi_events_key = original


def test_wompi_webhook_rejects_invalid_signature(db_session, client, unique_suffix):
    from app.core.config import get_settings

    settings = get_settings()
    original = settings.wompi_events_key
    settings.wompi_events_key = "events_test_secret"
    try:
        resp = client.post(
            "/webhooks/wompi",
            json={
                "data": {"transaction": {"id": "x", "status": "APPROVED", "reference": "whatever"}},
                "timestamp": "123",
                "signature": {"checksum": "not-the-real-checksum", "properties": ["transaction.id"]},
            },
        )
        assert resp.status_code == 422, resp.text
    finally:
        settings.wompi_events_key = original
