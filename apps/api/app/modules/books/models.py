"""Catálogo de libros digitales y sus compras (módulo nuevo, independiente de
cursos). Un libro es comprable por cualquier alumno del colegio; el archivo
digital solo puede verse/descargarse por quien tiene una BookPurchase "paid"
(ver books/service.py::require_book_purchase_access) — el catálogo en sí
(título, autor, precio) es de lectura abierta (permiso BOOKS_READ).
"""

from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import ForeignKey, Numeric, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, SchoolScopedMixin, TimestampMixin, UUIDPKMixin


class Book(UUIDPKMixin, TimestampMixin, SchoolScopedMixin, Base):
    """El archivo digital vive 1:1 con el libro (a diferencia de `files.File`, que
    es polimórfico): se modela como columnas propias en vez de una fila en
    `files` para no tocar el dispatch por `attached_to_type` de
    `files/service.py::get_download`, que no tiene noción de "compra". Quedan
    nulas hasta que se sube el archivo (`POST /books/{id}/file`)."""

    __tablename__ = "books"

    title: Mapped[str] = mapped_column(nullable=False)
    author: Mapped[str | None] = mapped_column(nullable=True)
    description: Mapped[str | None] = mapped_column(nullable=True)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    # "active" | "archived" (baja lógica, mismo criterio que Course/PaymentPlan):
    # un libro archivado no aparece en el catálogo para comprar, pero quien ya lo
    # compró conserva el acceso.
    status: Mapped[str] = mapped_column(nullable=False, default="active")

    file_filename: Mapped[str | None] = mapped_column(nullable=True)
    file_content_type: Mapped[str | None] = mapped_column(nullable=True)
    file_size_bytes: Mapped[int | None] = mapped_column(nullable=True)
    file_storage_key: Mapped[str | None] = mapped_column(nullable=True)


class BookPurchase(UUIDPKMixin, TimestampMixin, SchoolScopedMixin, Base):
    """Un intento/registro de compra. `method="colecturia"` se crea directamente
    en `status="paid"` (el admin ya cobró en caja, sección nueva, sin paso de
    aprobación — igual criterio que `billing.PaymentTransaction`).
    `method="wompi"` se crea en `status="pending"` y pasa a `paid`/`failed` solo
    por el webhook (`books/service.py::handle_wompi_webhook`), nunca por el
    redirect del navegador, que no es confiable como confirmación de pago.

    No hay UniqueConstraint en (book_id, student_id): una compra "failed"/
    "cancelled" no debe bloquear un reintento; la idempotencia "un alumno no
    paga dos veces el mismo libro" se aplica en el service (check-then-insert
    antes de iniciar/registrar una compra nueva), igual que
    `academics.service.enroll_student_in_course`."""

    __tablename__ = "book_purchases"
    __table_args__ = (
        UniqueConstraint("external_reference", name="uq_book_purchase_external_reference"),
    )

    book_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("books.id"), nullable=False, index=True
    )
    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("student_profiles.id"), nullable=False, index=True
    )
    method: Mapped[str] = mapped_column(nullable=False)
    status: Mapped[str] = mapped_column(nullable=False, default="pending")
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    # Quién registró la colecturía (null en compras por Wompi, donde nadie del
    # staff interviene).
    recorded_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    # Referencia única de la transacción Wompi (o un uuid4 propio generado al
    # iniciar la compra, antes de tener la de Wompi): clave de idempotencia del
    # webhook (ver books/service.py::handle_wompi_webhook). Null en colecturía.
    external_reference: Mapped[str | None] = mapped_column(nullable=True)
    paid_at: Mapped[date | None] = mapped_column(nullable=True)
