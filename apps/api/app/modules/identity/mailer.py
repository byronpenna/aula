"""Invitación por correo real (sección 6: "altas e invitaciones administradas"),
vía SES. Aislado en su propio módulo, mismo patrón que `cognito_admin.py`, para
poder simular `boto3.client` en tests sin tocar red real.

Queda inactivo mientras `settings.mail_from_address` no esté configurado — no hay
remitente válido sin una identidad verificada en SES (dominio o correo), y hoy
ningún entorno (local ni cloud) tiene una. Ver `identity/service.py::create_user`,
que decide si llama a este módulo o vuelve al flujo anterior (contraseña mostrada
en el formulario, compartida a mano por el administrador)."""

from __future__ import annotations

import html
import logging

import boto3
from botocore.exceptions import ClientError

from app.core.config import Settings

logger = logging.getLogger("aula.identity")


def mail_enabled(settings: Settings) -> bool:
    return bool(settings.mail_from_address)


def send_invitation_email(
    settings: Settings,
    *,
    to_email: str,
    display_name: str,
    username: str,
    temporary_password: str,
) -> bool:
    """Devuelve `True` si SES aceptó el envío. Nunca lanza: un correo que falla no
    debe deshacer el alta de la cuenta, ya creada en Cognito/local antes de llamar
    aquí — el llamador decide qué mostrarle al administrador según el resultado
    (p. ej. mostrar la contraseña igual si el envío falló)."""
    if not settings.mail_from_address:
        return False

    login_url = f"{settings.app_base_url}/login"
    safe_name = html.escape(display_name)
    safe_username = html.escape(username)
    body_text = (
        f"Hola {display_name},\n\n"
        f"Se creó tu cuenta en Aula Virtual.\n"
        f"Usuario: {username}\n"
        f"Contraseña temporal: {temporary_password}\n\n"
        f"Inicia sesión y cámbiala en tu primer ingreso: {login_url}\n"
    )
    body_html = (
        f"<p>Hola {safe_name},</p>"
        f"<p>Se creó tu cuenta en Aula Virtual.</p>"
        f"<p><strong>Usuario:</strong> {safe_username}<br>"
        f"<strong>Contraseña temporal:</strong> {html.escape(temporary_password)}</p>"
        f"<p>Inicia sesión y cámbiala en tu primer ingreso: "
        f'<a href="{login_url}">{html.escape(login_url)}</a></p>'
    )

    client = boto3.client("ses")
    try:
        client.send_email(
            Source=f"{settings.mail_from_name} <{settings.mail_from_address}>",
            Destination={"ToAddresses": [to_email]},
            Message={
                "Subject": {"Data": "Tu cuenta en Aula Virtual", "Charset": "UTF-8"},
                "Body": {
                    "Text": {"Data": body_text, "Charset": "UTF-8"},
                    "Html": {"Data": body_html, "Charset": "UTF-8"},
                },
            },
        )
        return True
    except ClientError:
        logger.exception("invitation_email_failed", extra={"to_email": to_email})
        return False
