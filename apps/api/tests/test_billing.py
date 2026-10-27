"""Planes de pago por año académico (módulo nuevo, permiso billing:manage):
definir el monto anual dividido en mensualidades, ver quién está matriculado ese
año (reutiliza Enrollment, no es un mecanismo de inscripción aparte) y asignarle
el plan una vez inscrito."""

from __future__ import annotations

from decimal import Decimal

from tests import factories as f


def test_admin_creates_plan_sets_months_and_assigns_to_enrolled_student(
    db_session, client, unique_suffix
):
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

    # Todavía no hay plan: aparece en inscritos pero sin plan asignado.
    enrolled_resp = client.get(f"/api/v1/academic-years/{year_id}/enrolled-students", headers=headers)
    assert enrolled_resp.status_code == 200, enrolled_resp.text
    assert len(enrolled_resp.json()) == 1
    row = enrolled_resp.json()[0]
    assert row["id"] == str(student_id)
    assert row["student_number"] == f"N-{unique_suffix}"
    assert row["display_name"] == "Alumno"
    assert row["section_id"] == str(structure["section"].id)
    assert row["has_payment_plan"] is False

    create_resp = client.post(
        f"/api/v1/academic-years/{year_id}/payment-plans",
        headers=headers,
        json={"name": "10 cuotas", "total_amount": "1000.00"},
    )
    assert create_resp.status_code == 200, create_resp.text
    plan_id = create_resp.json()["id"]
    assert create_resp.json()["status"] == "active"

    months_resp = client.post(
        f"/api/v1/payment-plans/{plan_id}/installments",
        headers=headers,
        json={"due_dates": ["2026-01-05", "2026-02-05", "2026-03-05"]},
    )
    assert months_resp.status_code == 200, months_resp.text
    amounts = [Decimal(i["amount"]) for i in months_resp.json()]
    assert sum(amounts) == Decimal("1000.00")
    # 1000 / 3 no es exacto: las primeras cuotas absorben el centavo extra.
    assert sorted(amounts) == [Decimal("333.33"), Decimal("333.33"), Decimal("333.34")]

    list_resp = client.get(f"/api/v1/academic-years/{year_id}/payment-plans", headers=headers)
    assert list_resp.status_code == 200, list_resp.text
    assert len(list_resp.json()) == 1
    assert len(list_resp.json()[0]["installments"]) == 3

    assign_resp = client.post(
        f"/api/v1/academic-years/{year_id}/students/{student_id}/payment-plan",
        headers=headers,
        json={"payment_plan_id": plan_id},
    )
    assert assign_resp.status_code == 200, assign_resp.text
    assert assign_resp.json()["payment_plan_name"] == "10 cuotas"
    assert assign_resp.json()["status"] == "active"
    assert len(assign_resp.json()["installments"]) == 3
    assert all(i["status"] == "pending" for i in assign_resp.json()["installments"])

    enrolled_after = client.get(
        f"/api/v1/academic-years/{year_id}/enrolled-students", headers=headers
    )
    assert enrolled_after.json()[0]["has_payment_plan"] is True

    get_resp = client.get(
        f"/api/v1/academic-years/{year_id}/students/{student_id}/payment-plan", headers=headers
    )
    assert get_resp.status_code == 200, get_resp.text
    assert get_resp.json()["payment_plan_name"] == "10 cuotas"


def test_finance_role_can_manage_but_teacher_cannot(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)
    finance_user = f.create_user(db_session, display_name="Finanzas", cognito_sub=f"f-{unique_suffix}")
    f.add_membership(db_session, school=school, user=finance_user, role_codes=["finance"])
    teacher = f.create_user(db_session, display_name="Docente", cognito_sub=f"t-{unique_suffix}")
    f.add_membership(db_session, school=school, user=teacher, role_codes=["teacher"])
    db_session.commit()

    year_id = structure["year"].id
    finance_headers = f.auth_headers(finance_user, school_id=school.id)
    teacher_headers = f.auth_headers(teacher, school_id=school.id)

    finance_resp = client.post(
        f"/api/v1/academic-years/{year_id}/payment-plans",
        headers=finance_headers,
        json={"name": "Plan", "total_amount": "500.00"},
    )
    assert finance_resp.status_code == 200, finance_resp.text

    teacher_resp = client.post(
        f"/api/v1/academic-years/{year_id}/payment-plans",
        headers=teacher_headers,
        json={"name": "Plan", "total_amount": "500.00"},
    )
    assert teacher_resp.status_code == 403

    teacher_list_resp = client.get(
        f"/api/v1/academic-years/{year_id}/payment-plans", headers=teacher_headers
    )
    assert teacher_list_resp.status_code == 403


def test_assign_rejects_unenrolled_student_and_plan_without_installments(
    db_session, client, unique_suffix
):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)
    admin = f.create_user(db_session, display_name="Admin", cognito_sub=f"a-{unique_suffix}")
    f.add_membership(db_session, school=school, user=admin, role_codes=["school_admin"])
    db_session.commit()

    headers = f.auth_headers(admin, school_id=school.id)
    year_id = structure["year"].id
    plan_id = client.post(
        f"/api/v1/academic-years/{year_id}/payment-plans",
        headers=headers,
        json={"name": "Plan", "total_amount": "300.00"},
    ).json()["id"]

    from app.modules.identity.models import StudentProfile

    unenrolled_profile = StudentProfile(
        school_id=school.id, user_id=None, student_number=f"X-{unique_suffix}"
    )
    db_session.add(unenrolled_profile)
    db_session.commit()

    # Sin mensualidades configuradas todavía.
    no_installments_resp = client.post(
        f"/api/v1/academic-years/{year_id}/students/{unenrolled_profile.id}/payment-plan",
        headers=headers,
        json={"payment_plan_id": plan_id},
    )
    assert no_installments_resp.status_code == 422

    client.post(
        f"/api/v1/payment-plans/{plan_id}/installments",
        headers=headers,
        json={"due_dates": ["2026-01-05"]},
    )

    # Con mensualidades, pero el alumno no está matriculado ese año.
    not_enrolled_resp = client.post(
        f"/api/v1/academic-years/{year_id}/students/{unenrolled_profile.id}/payment-plan",
        headers=headers,
        json={"payment_plan_id": plan_id},
    )
    assert not_enrolled_resp.status_code == 422


def test_archived_plan_rejects_new_assignments_and_reassignment_cancels_previous(
    db_session, client, unique_suffix
):
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

    plan_a = client.post(
        f"/api/v1/academic-years/{year_id}/payment-plans",
        headers=headers,
        json={"name": "Plan A", "total_amount": "600.00"},
    ).json()["id"]
    client.post(
        f"/api/v1/payment-plans/{plan_a}/installments",
        headers=headers,
        json={"due_dates": ["2026-01-05", "2026-02-05"]},
    )
    plan_b = client.post(
        f"/api/v1/academic-years/{year_id}/payment-plans",
        headers=headers,
        json={"name": "Plan B", "total_amount": "900.00"},
    ).json()["id"]
    client.post(
        f"/api/v1/payment-plans/{plan_b}/installments",
        headers=headers,
        json={"due_dates": ["2026-01-05", "2026-02-05", "2026-03-05"]},
    )

    assign_a = client.post(
        f"/api/v1/academic-years/{year_id}/students/{student_id}/payment-plan",
        headers=headers,
        json={"payment_plan_id": plan_a},
    )
    assert assign_a.status_code == 200, assign_a.text

    # Reasignar a Plan B cancela la asignación de Plan A en vez de duplicarla.
    assign_b = client.post(
        f"/api/v1/academic-years/{year_id}/students/{student_id}/payment-plan",
        headers=headers,
        json={"payment_plan_id": plan_b},
    )
    assert assign_b.status_code == 200, assign_b.text
    assert assign_b.json()["payment_plan_name"] == "Plan B"
    assert len(assign_b.json()["installments"]) == 3

    current = client.get(
        f"/api/v1/academic-years/{year_id}/students/{student_id}/payment-plan", headers=headers
    )
    assert current.json()["payment_plan_name"] == "Plan B"

    archive_resp = client.post(f"/api/v1/payment-plans/{plan_a}/archive", headers=headers)
    assert archive_resp.status_code == 200
    assert archive_resp.json()["status"] == "archived"

    archived_assign_resp = client.post(
        f"/api/v1/academic-years/{year_id}/students/{student_id}/payment-plan",
        headers=headers,
        json={"payment_plan_id": plan_a},
    )
    assert archived_assign_resp.status_code == 422


def test_update_total_amount_recomputes_existing_installments(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    structure = f.create_academic_structure(db_session, school)
    admin = f.create_user(db_session, display_name="Admin", cognito_sub=f"a-{unique_suffix}")
    f.add_membership(db_session, school=school, user=admin, role_codes=["school_admin"])
    db_session.commit()

    headers = f.auth_headers(admin, school_id=school.id)
    year_id = structure["year"].id
    plan_id = client.post(
        f"/api/v1/academic-years/{year_id}/payment-plans",
        headers=headers,
        json={"name": "Plan", "total_amount": "300.00"},
    ).json()["id"]
    client.post(
        f"/api/v1/payment-plans/{plan_id}/installments",
        headers=headers,
        json={"due_dates": ["2026-01-05", "2026-02-05", "2026-03-05"]},
    )

    update_resp = client.patch(
        f"/api/v1/payment-plans/{plan_id}", headers=headers, json={"total_amount": "600.00"}
    )
    assert update_resp.status_code == 200, update_resp.text

    list_resp = client.get(f"/api/v1/academic-years/{year_id}/payment-plans", headers=headers)
    plan = next(p for p in list_resp.json() if p["plan"]["id"] == plan_id)
    amounts = [Decimal(i["amount"]) for i in plan["installments"]]
    assert sum(amounts) == Decimal("600.00")
    assert len(amounts) == 3
