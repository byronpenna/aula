"""Adaptador de almacenamiento de archivos (sección 5/17).

Dos modos, igual que auth (`core/security.py`): local guarda en disco bajo el
volumen que Docker Compose ya monta (`./apps/api`), para poder probar el flujo
completo sin cuenta AWS; cloud sube al bucket privado ya provisto por
`infra/lib/api-stack.ts` (`FILES_BUCKET`) y solo entrega URLs firmadas de corta
duración, nunca acceso público directo (sección 11).
"""

from __future__ import annotations

from pathlib import Path
from typing import Protocol

from app.core.config import Settings

# apps/api/local_storage/files — fuera de git (ver .gitignore), persiste entre
# reinicios del contenedor porque compose.yaml monta ./apps/api en /app.
_LOCAL_STORAGE_DIR = Path(__file__).resolve().parents[3] / "local_storage" / "files"


class FileStorage(Protocol):
    def save(self, key: str, content: bytes) -> None: ...
    def read(self, key: str) -> bytes: ...
    def download_url(self, key: str) -> str | None:
        """URL firmada de descarga directa, o `None` si no aplica (local): en ese
        caso el caller debe servir el contenido él mismo vía `read`."""
        ...


class LocalFileStorage:
    def __init__(self, base_dir: Path = _LOCAL_STORAGE_DIR) -> None:
        self._base_dir = base_dir
        self._base_dir.mkdir(parents=True, exist_ok=True)

    def save(self, key: str, content: bytes) -> None:
        path = self._base_dir / key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)

    def read(self, key: str) -> bytes:
        return (self._base_dir / key).read_bytes()

    def download_url(self, key: str) -> str | None:
        return None


class S3FileStorage:  # pragma: no cover - requiere AWS real
    def __init__(self, bucket: str) -> None:
        import boto3

        self._bucket = bucket
        self._client = boto3.client("s3")

    def save(self, key: str, content: bytes) -> None:
        self._client.put_object(Bucket=self._bucket, Key=key, Body=content)

    def read(self, key: str) -> bytes:
        return self._client.get_object(Bucket=self._bucket, Key=key)["Body"].read()

    def download_url(self, key: str) -> str | None:
        return self._client.generate_presigned_url(
            "get_object", Params={"Bucket": self._bucket, "Key": key}, ExpiresIn=300
        )


def get_storage(settings: Settings) -> FileStorage:
    if settings.app_env == "local":
        return LocalFileStorage()
    return S3FileStorage(settings.files_bucket)
