from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict


class FileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    owner_user_id: uuid.UUID
    filename: str
    content_type: str
    size_bytes: int
    status: str
    created_at: datetime


class FileDownloadOut(BaseModel):
    """`url`: URL firmada para descargar directo (cloud). `content_base64`: usado
    solo en local, donde no hay S3 real que firme una URL (ver storage.py)."""

    url: str | None = None
    content_base64: str | None = None
    filename: str
    content_type: str


class FileNoteCreate(BaseModel):
    """`x`/`y`: ambos presentes para una nota de punto exacto (fracción 0..1 del
    ancho/alto de la página), ambos ausentes para una nota de página completa —
    nunca uno solo (ver files/service.py::create_file_note)."""

    page_number: int
    body: str
    x: float | None = None
    y: float | None = None


class FileNoteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    file_id: uuid.UUID
    author_user_id: uuid.UUID
    author_name: str = ""
    page_number: int
    x: float | None
    y: float | None
    body: str
    created_at: datetime
