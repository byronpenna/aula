"""Gestión de usuarios (Fase 3): alta local/Cognito, listar/filtrar, activar y
desactivar membresías, asignar/revocar roles, protección del último administrador
(ver identity/service.py)."""

from __future__ import annotations

from unittest.mock import MagicMock, patch

from app.core.config import Settings
from app.modules.identity import service as identity_service
from app.modules.identity.schemas import UserCreate
from tests import factories as f


def _admin(db_session, school, unique_suffix):
    admin = f.create_user(db_session, display_name="Admin", cognito_sub=f"a-{unique_suffix}")
    f.add_membership(db_session, school=school, user=admin, role_codes=["school_admin"])
    db_session.commit()
    return admin


def test_admin_can_create_user_local_and_login(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    admin = _admin(db_session, school, unique_suffix)
    headers = f.auth_headers(admin, school_id=school.id)

    resp = client.post(
        "/api/v1/users",
        headers=headers,
        json={
            "display_name": "Docente Nuevo",
            "email": "nuevo@example.com",
            "username": f"docente.nuevo.{unique_suffix}",
            "password": "Contrasena123",
            "role_code": "teacher",
        },
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["role_codes"] == ["teacher"]
    assert body["membership_status"] == "active"
    # Sin `mail_from_address` configurado en el ambiente de pruebas, la respuesta
    # sigue llevando la contraseña para que el administrador la comparta a mano.
    assert body["invitation_sent"] is False
    assert body["temporary_password"] == "Contrasena123"

    login_resp = client.post(
        "/api/v1/auth/local/token",
        json={"username": f"docente.nuevo.{unique_suffix}", "password": "Contrasena123"},
    )
    assert login_resp.status_code == 200, login_resp.text


def test_create_user_rejects_duplicate_username(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    admin = _admin(db_session, school, unique_suffix)
    headers = f.auth_headers(admin, school_id=school.id)

    payload = {
        "display_name": "Uno",
        "email": None,
        "username": f"dup.{unique_suffix}",
        "password": "Contrasena123",
        "role_code": "teacher",
    }
    first = client.post("/api/v1/users", headers=headers, json=payload)
    assert first.status_code == 200

    payload["display_name"] = "Dos"
    second = client.post("/api/v1/users", headers=headers, json=payload)
    assert second.status_code == 409


def test_create_user_cognito_branch_uses_admin_create_user(db_session, unique_suffix):
    """No hay credenciales AWS reales en esta sesión: se simula `boto3.client` para
    verificar que la rama de Cognito arma la llamada correcta y toma el `sub` de la
    respuesta como `cognito_sub`, sin tocar red real."""
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    admin = _admin(db_session, school, unique_suffix)
    db_session.commit()

    from app.core.deps import CurrentMembership
    from app.modules.identity import repository as identity_repo

    admin_membership = identity_repo.get_active_membership(db_session, admin.id, school.id)
    current = CurrentMembership(
        membership=admin_membership,
        school_id=school.id,
        role_codes=frozenset({"school_admin"}),
        permission_codes=frozenset({"users:manage"}),
    )

    settings = Settings(
        app_env="local",
        local_auth_enabled=False,
        cognito_user_pool_id="us-east-1_test123",
    )
    payload = UserCreate(
        display_name="Vía Cognito",
        email="cognito@example.com",
        username=f"cognito.{unique_suffix}",
        password="Contrasena123",
        role_code="teacher",
    )

    fake_client = MagicMock()
    fake_client.admin_create_user.return_value = {
        "User": {
            "Attributes": [
                {"Name": "sub", "Value": "11111111-2222-3333-4444-555555555555"},
                {"Name": "email", "Value": "cognito@example.com"},
            ]
        }
    }
    with patch("boto3.client", return_value=fake_client) as mock_boto:
        user, membership, invitation_sent = identity_service.create_user(
            db_session, settings, current, payload, request_id=None
        )

    mock_boto.assert_called_once_with("cognito-idp")
    call_kwargs = fake_client.admin_create_user.call_args.kwargs
    assert call_kwargs["UserPoolId"] == "us-east-1_test123"
    assert call_kwargs["Username"] == f"cognito.{unique_suffix}"
    assert call_kwargs["TemporaryPassword"] == "Contrasena123"
    assert call_kwargs["MessageAction"] == "SUPPRESS"
    assert user.cognito_sub == "11111111-2222-3333-4444-555555555555"
    assert membership.school_id == school.id
    # Sin `mail_from_address` configurado (no seteado arriba), no se intenta
    # enviar correo: `mock_boto` solo debe haberse llamado para cognito-idp.
    assert invitation_sent is False


def test_create_user_sends_invitation_email_when_mail_configured(db_session, unique_suffix):
    """Con `mail_from_address` configurado, el alta (rama local o Cognito, aquí
    local) dispara una invitación real por correo (SES, simulado) en vez de
    depender de que el administrador comparta la contraseña a mano."""
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    admin = _admin(db_session, school, unique_suffix)
    db_session.commit()

    from app.core.deps import CurrentMembership
    from app.modules.identity import repository as identity_repo

    admin_membership = identity_repo.get_active_membership(db_session, admin.id, school.id)
    current = CurrentMembership(
        membership=admin_membership,
        school_id=school.id,
        role_codes=frozenset({"school_admin"}),
        permission_codes=frozenset({"users:manage"}),
    )

    settings = Settings(
        app_env="local",
        local_auth_enabled=True,
        mail_from_address="no-reply@example.com",
    )
    payload = UserCreate(
        display_name="Con Invitación",
        email="invitada@example.com",
        username=f"invitada.{unique_suffix}",
        password="Contrasena123",
        role_code="teacher",
    )

    fake_client = MagicMock()
    with patch("boto3.client", return_value=fake_client) as mock_boto:
        user, membership, invitation_sent = identity_service.create_user(
            db_session, settings, current, payload, request_id=None
        )

    mock_boto.assert_called_once_with("ses")
    call_kwargs = fake_client.send_email.call_args.kwargs
    assert call_kwargs["Destination"]["ToAddresses"] == ["invitada@example.com"]
    assert "no-reply@example.com" in call_kwargs["Source"]
    assert invitation_sent is True
    assert user.id is not None
    assert membership.school_id == school.id


def test_create_user_account_survives_email_send_failure(db_session, unique_suffix):
    """Un correo que falla no debe deshacer el alta de la cuenta, ya creada antes
    de intentar el envío."""
    from botocore.exceptions import ClientError

    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    admin = _admin(db_session, school, unique_suffix)
    db_session.commit()

    from app.core.deps import CurrentMembership
    from app.modules.identity import repository as identity_repo

    admin_membership = identity_repo.get_active_membership(db_session, admin.id, school.id)
    current = CurrentMembership(
        membership=admin_membership,
        school_id=school.id,
        role_codes=frozenset({"school_admin"}),
        permission_codes=frozenset({"users:manage"}),
    )

    settings = Settings(
        app_env="local",
        local_auth_enabled=True,
        mail_from_address="no-reply@example.com",
    )
    payload = UserCreate(
        display_name="Correo Falla",
        email="falla@example.com",
        username=f"falla.{unique_suffix}",
        password="Contrasena123",
        role_code="teacher",
    )

    fake_client = MagicMock()
    fake_client.send_email.side_effect = ClientError(
        {"Error": {"Code": "MessageRejected", "Message": "rechazado"}}, "SendEmail"
    )
    with patch("boto3.client", return_value=fake_client):
        user, membership, invitation_sent = identity_service.create_user(
            db_session, settings, current, payload, request_id=None
        )

    assert invitation_sent is False
    assert user.id is not None
    assert membership.school_id == school.id


def test_list_and_filter_users(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    admin = _admin(db_session, school, unique_suffix)
    teacher = f.create_user(db_session, display_name="Docente Uno", cognito_sub=f"t-{unique_suffix}")
    f.add_membership(db_session, school=school, user=teacher, role_codes=["teacher"])
    db_session.commit()
    headers = f.auth_headers(admin, school_id=school.id)

    resp = client.get("/api/v1/users", headers=headers, params={"role": "teacher"})
    assert resp.status_code == 200
    names = [u["display_name"] for u in resp.json()]
    assert "Docente Uno" in names
    assert "Admin" not in names


def test_teacher_cannot_manage_users(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    teacher = f.create_user(db_session, display_name="Docente", cognito_sub=f"t2-{unique_suffix}")
    f.add_membership(db_session, school=school, user=teacher, role_codes=["teacher"])
    db_session.commit()
    headers = f.auth_headers(teacher, school_id=school.id)

    assert client.get("/api/v1/users", headers=headers).status_code == 403
    assert (
        client.post(
            "/api/v1/users",
            headers=headers,
            json={
                "display_name": "X",
                "username": "x",
                "password": "Contrasena123",
                "role_code": "teacher",
            },
        ).status_code
        == 403
    )


def test_activate_deactivate_and_role_assignment(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    admin = _admin(db_session, school, unique_suffix)
    teacher = f.create_user(db_session, display_name="Docente", cognito_sub=f"t3-{unique_suffix}")
    f.add_membership(db_session, school=school, user=teacher, role_codes=["teacher"])
    db_session.commit()
    headers = f.auth_headers(admin, school_id=school.id)

    deactivate = client.post(f"/api/v1/users/{teacher.id}/deactivate", headers=headers)
    assert deactivate.status_code == 200
    assert deactivate.json()["membership_status"] == "inactive"

    activate = client.post(f"/api/v1/users/{teacher.id}/activate", headers=headers)
    assert activate.status_code == 200
    assert activate.json()["membership_status"] == "active"

    assign = client.post(
        f"/api/v1/users/{teacher.id}/role-assignments",
        headers=headers,
        json={"role_code": "coordinator"},
    )
    assert assign.status_code == 200
    assert sorted(assign.json()["role_codes"]) == ["coordinator", "teacher"]

    revoke = client.delete(f"/api/v1/users/{teacher.id}/role-assignments/coordinator", headers=headers)
    assert revoke.status_code == 200
    assert revoke.json()["role_codes"] == ["teacher"]


def test_cannot_deactivate_last_admin(db_session, client, unique_suffix):
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    admin = _admin(db_session, school, unique_suffix)
    headers = f.auth_headers(admin, school_id=school.id)

    resp = client.post(f"/api/v1/users/{admin.id}/deactivate", headers=headers)
    assert resp.status_code == 409

    revoke = client.delete(f"/api/v1/users/{admin.id}/role-assignments/school_admin", headers=headers)
    assert revoke.status_code == 409


def test_cannot_deactivate_last_admin_when_another_admin_lacks_management_role(
    db_session, client, unique_suffix
):
    """Un segundo school_admin activo sí permite desactivar al primero."""
    f.ensure_role_catalog(db_session)
    school = f.create_school(db_session, f"Escuela {unique_suffix}")
    admin_one = _admin(db_session, school, unique_suffix)
    admin_two = f.create_user(
        db_session, display_name="Admin Dos", cognito_sub=f"a2-{unique_suffix}"
    )
    f.add_membership(db_session, school=school, user=admin_two, role_codes=["school_admin"])
    db_session.commit()
    headers = f.auth_headers(admin_one, school_id=school.id)

    resp = client.post(f"/api/v1/users/{admin_one.id}/deactivate", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["membership_status"] == "inactive"
