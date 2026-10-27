"""Contabilidad (sección nueva, billing:manage): registrar el cobro de una o
varias mensualidades del MISMO alumno en una sola transacción, en efectivo o con
tarjeta. En efectivo, el monto entregado es obligatorio (para calcular el
vuelto); con tarjeta, el número de autorización es obligatorio y nunca se guarda
uno en efectivo. Anular un pago borra su línea y, si era la última de su
transacción, la transacción también (nunca se marca pagada "a mano" sin estos
datos)."""

from __future__ import annotations

from decimal import Decimal

from tests import factories as f


def _setup_student_with_installments(db_session, client, unique_suffix, *, due_dates, amount_per_month="100.00"):
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
    db_session.commit()

    headers = f.auth_headers(admin, school_id=school.id)
    year_id = structure["year"].id
    student_id = enrolled["profile"].id
    total = str(Decimal(amount_per_month) * len(due_dates))

    plan_id = client.post(
        f"/api/v1/academic-years/{year_id}/payment-plans",
        headers=headers,
        json={"name": "Plan", "total_amount": total},
    ).json()["id"]
    client.post(
        f"/api/v1/payment-plans/{plan_id}/installments",
        headers=headers,
        json={"due_dates": due_dates},
    )
    client.post(
        f"/api/v1/academic-years/{year_id}/students/{student_id}/payment-plan",
        headers=headers,
        json={"payment_plan_id": plan_id},
    )
    status_resp = client.get(f"/api/v1/students/{student_id}/payment-status", headers=headers)
    installment_ids = [i["id"] for i in status_resp.json()["installments"]]
    return headers, installment_ids, student_id


def test_record_cash_payment_requires_amount_tendered_and_computes_change(
    db_session, client, unique_suffix
):
    headers, installment_ids, _ = _setup_student_with_installments(
        db_session, client, unique_suffix, due_dates=["2026-01-05"]
    )

    missing_amount = client.post(
        "/api/v1/payment-transactions",
        headers=headers,
        json={"student_installment_ids": installment_ids, "method": "cash"},
    )
    assert missing_amount.status_code == 422

    insufficient = client.post(
        "/api/v1/payment-transactions",
        headers=headers,
        json={"student_installment_ids": installment_ids, "method": "cash", "amount_tendered": "50.00"},
    )
    assert insufficient.status_code == 422

    resp = client.post(
        "/api/v1/payment-transactions",
        headers=headers,
        json={"student_installment_ids": installment_ids, "method": "cash", "amount_tendered": "150.00"},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["method"] == "cash"
    assert body["authorization_number"] is None
    assert Decimal(body["amount_total"]) == Decimal("100.00")
    assert Decimal(body["amount_tendered"]) == Decimal("150.00")
    assert Decimal(body["change_given"]) == Decimal("50.00")


def test_record_card_payment_requires_authorization_number(db_session, client, unique_suffix):
    headers, installment_ids, _ = _setup_student_with_installments(
        db_session, client, unique_suffix, due_dates=["2026-01-05"]
    )

    missing_auth = client.post(
        "/api/v1/payment-transactions",
        headers=headers,
        json={"student_installment_ids": installment_ids, "method": "card"},
    )
    assert missing_auth.status_code == 422

    blank_auth = client.post(
        "/api/v1/payment-transactions",
        headers=headers,
        json={
            "student_installment_ids": installment_ids,
            "method": "card",
            "authorization_number": "   ",
        },
    )
    assert blank_auth.status_code == 422

    ok_resp = client.post(
        "/api/v1/payment-transactions",
        headers=headers,
        json={
            "student_installment_ids": installment_ids,
            "method": "card",
            "authorization_number": "AUTH-12345",
        },
    )
    assert ok_resp.status_code == 200, ok_resp.text
    assert ok_resp.json()["authorization_number"] == "AUTH-12345"
    assert ok_resp.json()["amount_tendered"] is None
    assert ok_resp.json()["change_given"] is None


def test_pay_several_months_in_one_transaction(db_session, client, unique_suffix):
    headers, installment_ids, student_id = _setup_student_with_installments(
        db_session,
        client,
        unique_suffix,
        due_dates=["2026-01-05", "2026-02-05", "2026-03-05"],
        amount_per_month="100.00",
    )
    assert len(installment_ids) == 3

    resp = client.post(
        "/api/v1/payment-transactions",
        headers=headers,
        json={
            "student_installment_ids": installment_ids,
            "method": "cash",
            "amount_tendered": "300.00",
        },
    )
    assert resp.status_code == 200, resp.text
    assert Decimal(resp.json()["amount_total"]) == Decimal("300.00")
    assert Decimal(resp.json()["change_given"]) == Decimal("0.00")

    status_resp = client.get(f"/api/v1/students/{student_id}/payment-status", headers=headers)
    assert all(i["effective_status"] == "paid" for i in status_resp.json()["installments"])


def test_rejects_invalid_method_installments_from_different_students_and_double_payment(
    db_session, client, unique_suffix
):
    headers, installment_ids, _ = _setup_student_with_installments(
        db_session, client, unique_suffix, due_dates=["2026-01-05"]
    )

    invalid_resp = client.post(
        "/api/v1/payment-transactions",
        headers=headers,
        json={"student_installment_ids": installment_ids, "method": "check"},
    )
    assert invalid_resp.status_code == 422

    empty_resp = client.post(
        "/api/v1/payment-transactions",
        headers=headers,
        json={"student_installment_ids": [], "method": "cash", "amount_tendered": "1.00"},
    )
    assert empty_resp.status_code == 422

    first_resp = client.post(
        "/api/v1/payment-transactions",
        headers=headers,
        json={"student_installment_ids": installment_ids, "method": "cash", "amount_tendered": "100.00"},
    )
    assert first_resp.status_code == 200

    double_resp = client.post(
        "/api/v1/payment-transactions",
        headers=headers,
        json={"student_installment_ids": installment_ids, "method": "cash", "amount_tendered": "100.00"},
    )
    assert double_resp.status_code == 409


def test_rejects_mixing_installments_from_different_students(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)
    admin = f.create_user(db_session, display_name="Admin", cognito_sub=f"a-{unique_suffix}")
    f.add_membership(db_session, school=school, user=admin, role_codes=["school_admin"])
    headers = f.auth_headers(admin, school_id=school.id)
    year_id = structure["year"].id

    plan_id = client.post(
        f"/api/v1/academic-years/{year_id}/payment-plans",
        headers=headers,
        json={"name": "Plan", "total_amount": "100.00"},
    ).json()["id"]
    client.post(
        f"/api/v1/payment-plans/{plan_id}/installments",
        headers=headers,
        json={"due_dates": ["2026-01-05"]},
    )

    installment_ids = []
    for i in range(2):
        student_user = f.create_user(
            db_session, display_name=f"Alumno {i}", cognito_sub=f"s{i}-{unique_suffix}"
        )
        f.add_membership(db_session, school=school, user=student_user, role_codes=["student"])
        enrolled = f.enroll_student(
            db_session,
            school=school,
            structure=structure,
            student_user=student_user,
            student_number=f"N{i}-{unique_suffix}",
        )
        db_session.commit()
        client.post(
            f"/api/v1/academic-years/{year_id}/students/{enrolled['profile'].id}/payment-plan",
            headers=headers,
            json={"payment_plan_id": plan_id},
        )
        status_resp = client.get(
            f"/api/v1/students/{enrolled['profile'].id}/payment-status", headers=headers
        )
        installment_ids.append(status_resp.json()["installments"][0]["id"])

    resp = client.post(
        "/api/v1/payment-transactions",
        headers=headers,
        json={"student_installment_ids": installment_ids, "method": "cash", "amount_tendered": "200.00"},
    )
    assert resp.status_code == 422


def test_void_payment_requires_existing_payment_and_cleans_up_empty_transaction(
    db_session, client, unique_suffix
):
    headers, installment_ids, _ = _setup_student_with_installments(
        db_session, client, unique_suffix, due_dates=["2026-01-05"]
    )
    installment_id = installment_ids[0]

    not_found_resp = client.delete(
        f"/api/v1/student-installments/{installment_id}/payments", headers=headers
    )
    assert not_found_resp.status_code == 404

    client.post(
        "/api/v1/payment-transactions",
        headers=headers,
        json={
            "student_installment_ids": [installment_id],
            "method": "card",
            "authorization_number": "AUTH-1",
        },
    )
    void_resp = client.delete(
        f"/api/v1/student-installments/{installment_id}/payments", headers=headers
    )
    assert void_resp.status_code == 200
    assert void_resp.json()["status"] == "pending"
    assert void_resp.json()["payment"] is None

    # Tras anular, se puede registrar un pago nuevo sin chocar con el anterior.
    retry_resp = client.post(
        "/api/v1/payment-transactions",
        headers=headers,
        json={
            "student_installment_ids": [installment_id],
            "method": "cash",
            "amount_tendered": "100.00",
        },
    )
    assert retry_resp.status_code == 200, retry_resp.text
