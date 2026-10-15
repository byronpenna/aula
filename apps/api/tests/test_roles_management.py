"""Roles y permisos (Fase 3): matriz editable con control de versión optimista,
protección del rol school_admin, usuarios asignados (ver identity/service.py)."""

from __future__ import annotations

from tests import factories as f


def _admin(db_session, school, unique_suffix):
    admin = f.create_user(db_session, display_name="Admin", cognito_sub=f"a-{unique_suffix}")
    f.add_membership(db_session, school=school, user=admin, role_codes=["school_admin"])
    db_session.commit()
    return admin


def test_list_and_get_role(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    admin = _admin(db_session, school, unique_suffix)
    headers = f.auth_headers(admin, school_id=school.id)

    list_resp = client.get("/api/v1/roles", headers=headers)
    assert list_resp.status_code == 200
    codes = [r["code"] for r in list_resp.json()]
    assert "teacher" in codes
    teacher_row = next(r for r in list_resp.json() if r["code"] == "teacher")
    assert teacher_row["is_system"] is True
    assert "course:read" in teacher_row["permission_codes"]

    detail_resp = client.get("/api/v1/roles/teacher", headers=headers)
    assert detail_resp.status_code == 200
    assert detail_resp.json()["version"] == 1


def test_update_role_permissions_with_version_conflict(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    admin = _admin(db_session, school, unique_suffix)
    headers = f.auth_headers(admin, school_id=school.id)

    ok = client.put(
        "/api/v1/roles/teacher/permissions",
        headers=headers,
        json={"expected_version": 1, "permission_codes": ["course:read", "report:read"]},
    )
    assert ok.status_code == 200, ok.text
    assert ok.json()["version"] == 2
    assert sorted(ok.json()["permission_codes"]) == ["course:read", "report:read"]

    stale = client.put(
        "/api/v1/roles/teacher/permissions",
        headers=headers,
        json={"expected_version": 1, "permission_codes": ["course:read"]},
    )
    assert stale.status_code == 409


def test_cannot_strip_admin_management_permissions_from_school_admin(
    db_session, client, unique_suffix
):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    admin = _admin(db_session, school, unique_suffix)
    headers = f.auth_headers(admin, school_id=school.id)

    resp = client.put(
        "/api/v1/roles/school_admin/permissions",
        headers=headers,
        json={"expected_version": 1, "permission_codes": ["course:read"]},
    )
    assert resp.status_code == 422


def test_update_role_permissions_rejects_unknown_code(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    admin = _admin(db_session, school, unique_suffix)
    headers = f.auth_headers(admin, school_id=school.id)

    resp = client.put(
        "/api/v1/roles/teacher/permissions",
        headers=headers,
        json={"expected_version": 1, "permission_codes": ["not:a-real-permission"]},
    )
    assert resp.status_code == 422


def test_role_users_listing(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    admin = _admin(db_session, school, unique_suffix)
    teacher = f.create_user(db_session, display_name="Docente", cognito_sub=f"t-{unique_suffix}")
    f.add_membership(db_session, school=school, user=teacher, role_codes=["teacher"])
    db_session.commit()
    headers = f.auth_headers(admin, school_id=school.id)

    resp = client.get("/api/v1/roles/teacher/users", headers=headers)
    assert resp.status_code == 200
    names = [u["display_name"] for u in resp.json()]
    assert names == ["Docente"]


def test_teacher_cannot_manage_roles(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    teacher = f.create_user(db_session, display_name="Docente", cognito_sub=f"t2-{unique_suffix}")
    f.add_membership(db_session, school=school, user=teacher, role_codes=["teacher"])
    db_session.commit()
    headers = f.auth_headers(teacher, school_id=school.id)

    assert client.get("/api/v1/roles", headers=headers).status_code == 403
    assert (
        client.put(
            "/api/v1/roles/teacher/permissions",
            headers=headers,
            json={"expected_version": 1, "permission_codes": []},
        ).status_code
        == 403
    )
