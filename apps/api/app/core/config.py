"""Configuración de la aplicación.

Todos los valores tienen un default seguro para desarrollo local; en dev/staging/prod
se espera que las variables reales vengan de Secrets Manager / variables de entorno de
Lambda, nunca de este archivo. Ver `.env.example` para la lista completa de variables.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

AppEnv = Literal["local", "dev", "staging", "prod"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: AppEnv = "local"
    log_level: str = "INFO"

    # Base de datos: en local se arma desde piezas sueltas (DATABASE_URL directo).
    # En cloud, la Lambda recibe DB_PROXY_ENDPOINT + DB_SECRET_ARN (no una URL
    # completa); `get_settings()` resuelve el secreto una sola vez por contenedor
    # frío y construye `database_url` a partir de ellos (ver `_resolve_cloud_database_url`).
    database_url: str = "postgresql+psycopg://aula:aula@localhost:5432/aula"
    db_proxy_endpoint: str | None = None
    db_secret_arn: str | None = None
    db_pool_size: int = 1
    db_max_overflow: int = 0
    db_statement_timeout_ms: int = 5000

    # Identidad / auth
    school_timezone: str = "America/El_Salvador"
    api_scope: str = "school-api/access"

    # Cognito (fase cloud; sin User Pool real todavía, valores placeholder)
    cognito_issuer: str | None = None
    cognito_client_id: str | None = None
    cognito_jwks_cache_seconds: int = 3600

    # Auth local (solo dev): adaptador de tokens firmados propios, JAMÁS en prod.
    local_auth_enabled: bool = True
    local_jwt_secret: str = "local-only-dev-secret-do-not-use-in-cloud"
    local_jwt_issuer: str = "aula-local-dev"
    local_jwt_ttl_seconds: int = 3600

    files_bucket: str = "aula-files-local"
    # :5173 es apps/web (Vite) en dev; :3000 es apps/public_web (Next.js) en dev,
    # cuyo área admin llama a esta API (sección 7).
    allowed_origins: list[str] = ["http://localhost:5173", "http://localhost:3000"]

    @model_validator(mode="after")
    def _guard_local_auth(self) -> Settings:
        if self.local_auth_enabled and self.app_env != "local":
            raise RuntimeError(
                "local_auth_enabled=true requiere APP_ENV=local. "
                "No se permite el adaptador de auth local fuera de desarrollo local."
            )
        if self.app_env != "local" and not self.cognito_issuer:
            raise RuntimeError(
                f"APP_ENV={self.app_env} requiere COGNITO_ISSUER configurado; "
                "no hay adaptador de auth alternativo fuera de local."
            )
        return self


def _resolve_cloud_database_url(settings: Settings) -> Settings:
    """Construye `database_url` desde Secrets Manager + RDS Proxy (sección 4).

    Se llama una sola vez por contenedor cálido (memoizado vía `get_settings`),
    no en cada request. `sslmode=require` porque el proxy exige TLS
    (`requireTLS: true` en infra/lib/data-stack.ts); no valida el certificado
    completo todavía (pendiente de endurecer con el bundle de CA de RDS).
    """
    import json

    import boto3

    client = boto3.client("secretsmanager")
    secret = json.loads(
        client.get_secret_value(SecretId=settings.db_secret_arn)["SecretString"]
    )
    username = secret["username"]
    password = secret["password"]
    dbname = secret.get("dbname", "aula")
    url = (
        f"postgresql+psycopg://{username}:{password}"
        f"@{settings.db_proxy_endpoint}:5432/{dbname}?sslmode=require"
    )
    return settings.model_copy(update={"database_url": url})


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    if settings.db_secret_arn and settings.db_proxy_endpoint:
        settings = _resolve_cloud_database_url(settings)
    return settings
