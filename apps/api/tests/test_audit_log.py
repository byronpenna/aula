"""Auditoría de solo lectura (Fase 3): filtrada por colegio, requiere `audit:read`,
nunca expone el campo `changes` (sección 6: "minimizado/redactado")."""

from __future__ import annotations

from tests import factories as f


def test_audit_log_read_and_redaction(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    admin = f.create_user(db_session, display_name="Admin", cognito_sub=f"a-{unique_suffix}")
    f.add_membership(db_session, school=school, user=admin, role_codes=["school_admin"])
    db_session.commit()
    headers = f.auth_headers(admin, school_id=school.id)

    # Generar un evento real de auditoría a través de una acción ya cubierta.
    year_resp = client.post(
        "/api/v1/academic-years",
        headers=headers,
        json={"label": f"Y{unique_suffix}", "starts_on": "2026-01-01", "ends_on": "2026-11-30"},
    )
    assert year_resp.status_code == 200

    resp = client.get("/api/v1/audit-logs", headers=headers)
    assert resp.status_code == 200
    events = resp.json()
    assert any(e["action"] == "academic_year.create" for e in events)
    for event in events:
        assert "changes" not in event
        assert event["actor_display_name"] == "Admin"


def test_audit_log_requires_permission(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    teacher = f.create_user(db_session, display_name="Docente", cognito_sub=f"t-{unique_suffix}")
    f.add_membership(db_session, school=school, user=teacher, role_codes=["teacher"])
    db_session.commit()
    headers = f.auth_headers(teacher, school_id=school.id)

    resp = client.get("/api/v1/audit-logs", headers=headers)
    assert resp.status_code == 403


def test_audit_log_scoped_to_school(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school_1 = f.create_school(db_session, f"Escuela1 {unique_suffix}")
    school_2 = f.create_school(db_session, f"Escuela2 {unique_suffix}")
    admin_1 = f.create_user(db_session, display_name="Admin1", cognito_sub=f"a1-{unique_suffix}")
    f.add_membership(db_session, school=school_1, user=admin_1, role_codes=["school_admin"])
    admin_2 = f.create_user(db_session, display_name="Admin2", cognito_sub=f"a2-{unique_suffix}")
    f.add_membership(db_session, school=school_2, user=admin_2, role_codes=["school_admin"])
    db_session.commit()

    client.post(
        "/api/v1/academic-years",
        headers=f.auth_headers(admin_2, school_id=school_2.id),
        json={"label": f"S2-{unique_suffix}", "starts_on": "2026-01-01", "ends_on": "2026-11-30"},
    )

    resp = client.get("/api/v1/audit-logs", headers=f.auth_headers(admin_1, school_id=school_1.id))
    assert resp.status_code == 200
    assert resp.json() == []
