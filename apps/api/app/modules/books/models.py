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
from sqlalchemy.dialects.postgresql import JSONB, UUID
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


class BookFileVersion(UUIDPKMixin, TimestampMixin, SchoolScopedMixin, Base):
    """Historial de archivos subidos para un libro (sección nueva: gestión de
    versiones). A lo sumo una fila por libro tiene `is_active=True` — esa es la
    que se copia a `Book.file_*` (ver `books/service.py::_sync_book_active_file`)
    para que `get_book_content`/`BookOut` sigan leyendo de esas columnas sin
    cambios. Desactivar la versión activa sin activar otra deja al libro sin
    archivo legible (mismo estado que antes de la primera subida) — las
    versiones nunca se borran, solo se activan/desactivan."""

    __tablename__ = "book_file_versions"

    book_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("books.id"), nullable=False, index=True
    )
    filename: Mapped[str] = mapped_column(nullable=False)
    content_type: Mapped[str] = mapped_column(nullable=False)
    size_bytes: Mapped[int] = mapped_column(nullable=False)
    storage_key: Mapped[str] = mapped_column(nullable=False)
    is_active: Mapped[bool] = mapped_column(nullable=False, default=False)
    uploaded_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )


class BookAnnotation(UUIDPKMixin, TimestampMixin, SchoolScopedMixin, Base):
    """Notas y resaltados personales de quien lee un libro (sección nueva). Cada
    fila referencia exactamente un esquema de ubicación según el formato del
    archivo activo al momento de crearla — PDF: `page_number` + `rects` (uno o
    más recuadros de la selección de texto, fracciones 0..1 del tamaño
    renderizado de esa página); EPUB: `cfi_range` (epub.js resuelve solo a qué
    posición del libro corresponde). Nunca ambos — se valida en el service.

    `is_shared=False` por defecto (privada del autor, como subrayar tu propio
    libro); si se activa, cualquier otro usuario con acceso de compra al mismo
    libro (ver `require_book_purchase_access`) también la ve — igual criterio
    de acceso que el contenido del libro, nunca más amplio."""

    __tablename__ = "book_annotations"

    book_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("books.id"), nullable=False, index=True
    )
    author_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )
    kind: Mapped[str] = mapped_column(nullable=False)  # "note" | "highlight"
    color: Mapped[str | None] = mapped_column(nullable=True)  # solo highlights
    body: Mapped[str | None] = mapped_column(nullable=True)  # requerido en notas
    is_shared: Mapped[bool] = mapped_column(nullable=False, default=False)
    page_number: Mapped[int | None] = mapped_column(nullable=True)
    x: Mapped[float | None] = mapped_column(nullable=True)
    y: Mapped[float | None] = mapped_column(nullable=True)
    rects: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    cfi_range: Mapped[str | None] = mapped_column(nullable=True)


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
