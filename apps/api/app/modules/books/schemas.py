from __future__ import annotations

import uuid
from datetime import date, datetime
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class BookCreate(BaseModel):
    title: str
    author: str | None = None
    description: str | None = None
    price: Decimal


class BookUpdate(BaseModel):
    title: str | None = None
    author: str | None = None
    description: str | None = None
    price: Decimal | None = None


class BookOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    title: str
    author: str | None
    description: str | None
    price: Decimal
    status: str
    file_filename: str | None
    file_content_type: str | None
    file_size_bytes: int | None
    created_at: datetime
    # Solo presente cuando el caller es un estudiante/tutor (no en el catálogo
    # administrativo): si ya tiene una compra "paid" de este libro.
    owned: bool = False


class BookFileVersionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    filename: str
    content_type: str
    size_bytes: int
    is_active: bool
    uploaded_by_user_id: uuid.UUID | None
    created_at: datetime


class BookPurchaseOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    book_id: uuid.UUID
    student_id: uuid.UUID
    method: str
    status: str
    amount: Decimal
    recorded_by_user_id: uuid.UUID | None
    paid_at: date | None
    created_at: datetime
    student_display_name: str | None = None


class ColecturiaPurchaseCreate(BaseModel):
    student_id: uuid.UUID


class WompiCheckoutOut(BaseModel):
    """Datos para que el frontend arme la URL de redirección al Web Checkout de
    Wompi (sección nueva, books/wompi_client.py::build_checkout_signature): no
    hay llamada HTTP saliente para iniciar la compra, el checkout de Wompi
    funciona por redirección firmada."""

    reference: str
    amount_in_cents: int
    currency: str
    public_key: str
    integrity_signature: str
    checkout_base_url: str
