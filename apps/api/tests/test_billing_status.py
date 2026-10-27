"""Estado de pagos de un alumno en su ficha (/students/:id, sección nueva):
docente que comparte un curso con él, o admin/coordinación — nunca el propio
alumno ni su tutor (academics_service.require_student_billing_access, más
angosto que require_student_access). "paid"/"pending"/"overdue" se calcula al
leer contra la fecha de hoy; registrar un pago sigue siendo billing:manage (solo
admin/finance) — la ficha del alumno es de solo lectura, nunca un docente puede
marcar nada como pagado (ver test_billing_payments.py para el módulo de pagos)."""

from __future__ import annotations

from decimal import Decimal

from tests import factories as f


def _setup_student_with_plan(db_session, client, unique_suffix, *, due_dates):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)
    admin = f.create_user(db_session, display_name="Admin", cognito_sub=f"a-{unique_suffix}")
    f.add_membership(db_session, school=school, user=admin, role_codes=["school_admin"])
    teacher = f.create_user(db_session, display_name="Docente", cognito_sub=f"t-{unique_suffix}")
    f.add_membership(db_session, school=school, user=teacher, role_codes=["teacher"])
    f.assign_teacher(db_session, school=school, course=structure["course"], teacher_user=teacher)
    other_teacher = f.create_user(
        db_session, display_name="Otro Docente", cognito_sub=f"ot-{unique_suffix}"
    )
    f.add_membership(db_session, school=school, user=other_teacher, role_codes=["teacher"])
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
    f.link_guardian(db_session, school=school, guardian_user=guardian, student_profile=enrolled["profile"])
    db_session.commit()

    admin_headers = f.auth_headers(admin, school_id=school.id)
    year_id = structure["year"].id
    student_id = enrolled["profile"].id

    plan_id = client.post(
        f"/api/v1/academic-years/{year_id}/payment-plans",
        headers=admin_headers,
        json={"name": "Plan", "total_amount": str(Decimal("100.00") * len(due_dates))},
    ).json()["id"]
    client.post(
        f"/api/v1/payment-plans/{plan_id}/installments",
        headers=admin_headers,
        json={"due_dates": due_dates},
    )
    client.post(
        f"/api/v1/academic-years/{year_id}/students/{student_id}/payment-plan",
        headers=admin_headers,
        json={"payment_plan_id": plan_id},
    )

    return {
        "admin_headers": admin_headers,
        "teacher_headers": f.auth_headers(teacher, school_id=school.id),
        "other_teacher_headers": f.auth_headers(other_teacher, school_id=school.id),
        "student_headers": f.auth_headers(student_user, school_id=school.id),
        "guardian_headers": f.auth_headers(guardian, school_id=school.id),
        "student_id": student_id,
    }


def test_sharing_teacher_and_admin_see_status_with_overdue_computed(db_session, client, unique_suffix):
    ctx = _setup_student_with_plan(
        db_session, client, unique_suffix, due_dates=["2026-01-05", "2026-12-05"]
    )

    for headers in (ctx["admin_headers"], ctx["teacher_headers"]):
        resp = client.get(f"/api/v1/students/{ctx['student_id']}/payment-status", headers=headers)
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body is not None
        statuses = {i["due_date"]: i["effective_status"] for i in body["installments"]}
        assert statuses["2026-01-05"] == "overdue"
        assert statuses["2026-12-05"] == "pending"


def test_unrelated_teacher_guardian_and_student_cannot_view_status(db_session, client, unique_suffix):
    ctx = _setup_student_with_plan(db_session, client, unique_suffix, due_dates=["2026-12-05"])

    for headers in (ctx["other_teacher_headers"], ctx["guardian_headers"], ctx["student_headers"]):
        resp = client.get(f"/api/v1/students/{ctx['student_id']}/payment-status", headers=headers)
        assert resp.status_code == 404


def test_admin_records_payment_but_teacher_cannot(db_session, client, unique_suffix):
    ctx = _setup_student_with_plan(db_session, client, unique_suffix, due_dates=["2026-01-05"])

    status_resp = client.get(
        f"/api/v1/students/{ctx['student_id']}/payment-status", headers=ctx["admin_headers"]
    )
    installment_id = status_resp.json()["installments"][0]["id"]
    assert status_resp.json()["installments"][0]["effective_status"] == "overdue"

    forbidden = client.post(
        "/api/v1/payment-transactions",
        headers=ctx["teacher_headers"],
        json={"student_installment_ids": [installment_id], "method": "cash", "amount_tendered": "100.00"},
    )
    assert forbidden.status_code == 403

    pay_resp = client.post(
        "/api/v1/payment-transactions",
        headers=ctx["admin_headers"],
        json={"student_installment_ids": [installment_id], "method": "cash", "amount_tendered": "100.00"},
    )
    assert pay_resp.status_code == 200, pay_resp.text
    assert pay_resp.json()["method"] == "cash"

    status_after_pay = client.get(
        f"/api/v1/students/{ctx['student_id']}/payment-status", headers=ctx["admin_headers"]
    )
    assert status_after_pay.json()["installments"][0]["status"] == "paid"
    assert status_after_pay.json()["installments"][0]["effective_status"] == "paid"
    assert status_after_pay.json()["installments"][0]["payment"]["method"] == "cash"

    refreshed = client.get(
        f"/api/v1/students/{ctx['student_id']}/payment-status", headers=ctx["teacher_headers"]
    )
    assert refreshed.json()["installments"][0]["effective_status"] == "paid"
    # El docente ve el pago pero no puede anularlo.
    assert (
        client.delete(
            f"/api/v1/student-installments/{installment_id}/payments", headers=ctx["teacher_headers"]
        ).status_code
        == 403
    )

    void_resp = client.delete(
        f"/api/v1/student-installments/{installment_id}/payments", headers=ctx["admin_headers"]
    )
    assert void_resp.status_code == 200
    assert void_resp.json()["effective_status"] == "overdue"
    assert void_resp.json()["payment"] is None


def test_no_active_year_or_no_plan_returns_null_not_error(db_session, client, unique_suffix):
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
    enrolled = f.enroll_student(
        db_session,
        school=school,
        structure=structure,
        student_user=student_user,
        student_number=f"N-{unique_suffix}",
    )
    db_session.commit()

    resp = client.get(
        f"/api/v1/students/{enrolled['profile'].id}/payment-status",
        headers=f.auth_headers(teacher, school_id=school.id),
    )
    assert resp.status_code == 200
    assert resp.json() is None
