"""Cliente delgado sobre `cognito-idp` para altas administradas (Fase 3, sección 6
de aula_virtual_linares_agente_v2/03-USUARIOS-ROLES-Y-SEGURIDAD.md: "Altas e
invitaciones administradas", ver también el comentario homónimo en
infra/lib/identity-stack.ts).

Se usa solo fuera de `APP_ENV=local` (ver `identity/service.py::create_user`); en
local, las cuentas se crean con el adaptador de credenciales locales
(`LocalAuthCredential`), nunca con Cognito real. Aislado en su propio módulo para
poder simular `boto3.client` en tests sin tocar red real.
"""

from __future__ import annotations

import boto3
from botocore.exceptions import ClientError

from app.core.config import Settings
from app.core.errors import ConflictError, UnprocessableError


def admin_create_user(
    settings: Settings, *, username: str, email: str | None, temporary_password: str
) -> str:
    """Crea el usuario en el User Pool real y devuelve su `sub` (UUID de Cognito) —
    es la clave que el resto del sistema usa como `User.cognito_sub`
    (`core/security.py::verify_access_token` lee `sub` del access token, nunca el
    username). `MessageAction=SUPPRESS` porque no hay servicio de correo (SES)
    configurado todavía; la contraseña temporal se comunica desde la propia UI, no
    por email — Cognito de todos modos exige cambiarla en el primer inicio de sesión."""
    if not settings.cognito_user_pool_id:
        raise UnprocessableError(
            "COGNITO_USER_POOL_ID no está configurado en este ambiente; "
            "no se puede crear el usuario en Cognito."
        )
    client = boto3.client("cognito-idp")
    attributes = [{"Name": "email", "Value": email}] if email else []
    try:
        response = client.admin_create_user(
            UserPoolId=settings.cognito_user_pool_id,
            Username=username,
            UserAttributes=attributes,
            TemporaryPassword=temporary_password,
            MessageAction="SUPPRESS",
        )
    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code")
        if code == "UsernameExistsException":
            raise ConflictError(f"Ya existe un usuario con el nombre '{username}'.") from exc
        if code == "InvalidPasswordException":
            raise UnprocessableError(
                "La contraseña no cumple la política del proveedor de identidad "
                "(mínimo 12 caracteres, mayúscula, minúscula y dígito)."
            ) from exc
        raise
    return next(
        attr["Value"] for attr in response["User"]["Attributes"] if attr["Name"] == "sub"
    )
