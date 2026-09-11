"""Verificación y emisión de tokens (sección 6 del documento de arquitectura).

Dos modos:
- local: HS256 firmado con `local_jwt_secret`, solo si `APP_ENV=local`. Reemplaza a
  Cognito para poder desarrollar sin cuenta AWS. `Settings` ya se niega a habilitar
  este modo fuera de local (ver `core/config.py::_guard_local_auth`).
- cloud (dev/staging/prod): JWT de Cognito validado contra JWKS remoto, exigiendo
  issuer, audience/client_id y `token_use=access` (nunca ID token como credencial).

El backend SIEMPRE revalida token_use, client_id, scope y estado activo del usuario en
DB, incluso si el authorizer de API Gateway ya filtró el request (sección 6, [S1]).
"""

from __future__ import annotations

import time
from dataclasses import dataclass
from functools import lru_cache

from jose import jwt
from jose.exceptions import JOSEError

from app.core.config import Settings
from app.core.errors import UnauthorizedError


@dataclass(frozen=True)
class TokenClaims:
    sub: str
    token_use: str
    client_id: str | None
    scope: str
    issuer: str
    expires_at: int


def issue_local_token(settings: Settings, *, cognito_sub: str, scope: str | None = None) -> str:
    if not settings.local_auth_enabled:
        raise RuntimeError("El emisor de tokens locales está deshabilitado en este ambiente.")
    now = int(time.time())
    claims = {
        "sub": cognito_sub,
        "token_use": "access",
        "client_id": "local-dev-client",
        "scope": scope or settings.api_scope,
        "iss": settings.local_jwt_issuer,
        "iat": now,
        "exp": now + settings.local_jwt_ttl_seconds,
    }
    return jwt.encode(claims, settings.local_jwt_secret, algorithm="HS256")


def _decode_local(token: str, settings: Settings) -> dict:
    try:
        return jwt.decode(
            token,
            settings.local_jwt_secret,
            algorithms=["HS256"],
            issuer=settings.local_jwt_issuer,
            options={"verify_aud": False},
        )
    except JOSEError as exc:
        raise UnauthorizedError("Token local inválido o expirado.") from exc


@lru_cache(maxsize=4)
def _jwks_client(issuer: str):  # pragma: no cover - requiere Cognito real
    """Cliente JWKS para Cognito. Se resuelve perezosamente; sin cuenta AWS
    configurada este camino no se ejerce todavía (ver docs/runbooks/aws-profile-setup.md)."""
    import httpx

    jwks_url = f"{issuer}/.well-known/jwks.json"
    response = httpx.get(jwks_url, timeout=5.0)
    response.raise_for_status()
    return response.json()


def _decode_cognito(token: str, settings: Settings) -> dict:  # pragma: no cover
    if not settings.cognito_issuer or not settings.cognito_client_id:
        raise UnauthorizedError("Cognito no está configurado en este ambiente.")
    jwks = _jwks_client(settings.cognito_issuer)
    try:
        unverified_header = jwt.get_unverified_header(token)
        key = next(k for k in jwks["keys"] if k["kid"] == unverified_header["kid"])
        return jwt.decode(
            token,
            key,
            algorithms=["RS256"],
            issuer=settings.cognito_issuer,
            audience=settings.cognito_client_id,
        )
    except (JOSEError, StopIteration, KeyError) as exc:
        raise UnauthorizedError("Token de Cognito inválido, expirado o de otra app.") from exc


def verify_access_token(token: str, settings: Settings) -> TokenClaims:
    """Decodifica y valida el JWT. Exige explícitamente token_use=access, client_id
    esperado y scope de la API — no basta con que el authorizer de HTTP API haya
    aceptado el token (sección 6, [S1])."""
    raw = _decode_local(token, settings) if settings.app_env == "local" else _decode_cognito(
        token, settings
    )

    token_use = raw.get("token_use")
    if token_use != "access":
        raise UnauthorizedError("Se requiere un access token, no un ID token.")

    client_id = raw.get("client_id") or raw.get("aud")
    if settings.app_env != "local" and client_id != settings.cognito_client_id:
        raise UnauthorizedError("El token no fue emitido para este cliente.")

    scope = raw.get("scope", "")
    required_scopes = set(settings.api_scope.split())
    token_scopes = set(scope.split())
    if not required_scopes.issubset(token_scopes):
        raise UnauthorizedError("El token no tiene el scope requerido por la API.")

    sub = raw.get("sub")
    if not sub:
        raise UnauthorizedError("El token no tiene un sujeto (sub) válido.")

    return TokenClaims(
        sub=sub,
        token_use=token_use,
        client_id=client_id,
        scope=scope,
        issuer=raw.get("iss", ""),
        expires_at=int(raw.get("exp", 0)),
    )
