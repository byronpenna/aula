"""Reglas de negocio del catálogo de libros y sus compras (módulo nuevo).

Regla universal (sección 6): el catálogo (título, autor, precio) es de lectura
abierta a cualquiera con el permiso `books:read`; lo único gateado por compra es
el contenido — ver `require_book_purchase_access`/`get_book_download`, mismo
criterio "404 si no hay acceso" que `files/service.py::get_download`.
"""

from __future__ import annotations

import base64
import uuid
from datetime import UTC, date, datetime
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.deps import CurrentMembership
from app.core.errors import ForbiddenError, NotFoundError, UnprocessableError
from app.modules.books import repository as books_repo
from app.modules.books import wompi_client
from app.modules.books.models import Book, BookPurchase
from app.modules.files.storage import get_storage
from app.modules.identity import repository as identity_repo
from app.modules.identity import service as identity_service

ALLOWED_BOOK_CONTENT_TYPES = {"application/pdf", "application/epub+zip"}
MAX_BOOK_FILE_SIZE_BYTES = 50 * 1024 * 1024


def _require_book(db: Session, school_id: uuid.UUID, book_id: uuid.UUID) -> Book:
    book = books_repo.get_book(db, school_id, book_id)
    if book is None:
        raise NotFoundError("El libro indicado no existe en este colegio.")
    return book


def _clean_text(value: str) -> str:
    return " ".join(value.strip().split())


def _resolve_student_ids(
    db: Session, current: CurrentMembership, user_id: uuid.UUID
) -> list[uuid.UUID]:
    """Alumnos relevantes para decidir qué puede ver/comprar el usuario actual: su
    propio perfil si es alumno, o los alumnos que tiene vinculados si es tutor."""
    ids: list[uuid.UUID] = []
    if "student" in current.role_codes:
        profile = identity_repo.get_student_profile_by_user(db, current.school_id, user_id)
        if profile is not None:
            ids.append(profile.id)
    if "guardian" in current.role_codes:
        for link in identity_repo.get_active_guardian_links(db, user_id):
            if link.school_id == current.school_id:
                ids.append(link.student_id)
    return ids


def _is_owned(db: Session, current: CurrentMembership, user_id: uuid.UUID, book: Book) -> bool:
    for student_id in _resolve_student_ids(db, current, user_id):
        if books_repo.get_paid_purchase(db, current.school_id, book.id, student_id) is not None:
            return True
    return False


def require_book_purchase_access(
    db: Session, current: CurrentMembership, user_id: uuid.UUID, book: Book
) -> None:
    """Quien administra/cobra el colegio puede ver/descargar cualquier libro
    (soporte y auditoría, mismo criterio que `require_course_access` con
    school_admin/coordinator); cualquier otro usuario solo si tiene una compra
    `paid`, propia o de un alumno que tiene vinculado. Nunca 403: oculta
    existencia (sección 6)."""
    if book.school_id != current.school_id:
        raise NotFoundError("El libro indicado no existe en este colegio.")
    if {"school_admin", "coordinator"} & current.role_codes or "finance" in current.role_codes:
        return
    if _is_owned(db, current, user_id, book):
        return
    raise NotFoundError("El libro indicado no existe o no has comprado acceso a él.")


def list_catalog(
    db: Session, current: CurrentMembership, user_id: uuid.UUID, *, include_archived: bool
) -> list[tuple[Book, bool]]:
    staff = (
        bool({"school_admin", "coordinator"} & current.role_codes)
        or "finance" in current.role_codes
    )
    books = books_repo.list_books(
        db, current.school_id, include_archived=include_archived and staff
    )
    return [(book, _is_owned(db, current, user_id, book)) for book in books]


def get_book_detail(
    db: Session, current: CurrentMembership, user_id: uuid.UUID, book_id: uuid.UUID
) -> tuple[Book, bool]:
    book = _require_book(db, current.school_id, book_id)
    return book, _is_owned(db, current, user_id, book)


def create_book(
    db: Session,
    current: CurrentMembership,
    title: str,
    author: str | None,
    description: str | None,
    price: Decimal,
    request_id: str | None,
) -> Book:
    clean_title = _clean_text(title)
    if not clean_title:
        raise UnprocessableError("El título no puede estar vacío.")
    if price <= 0:
        raise UnprocessableError("El precio debe ser mayor que cero.")

    book = Book(
        school_id=current.school_id,
        title=clean_title,
        author=_clean_text(author) if author else None,
        description=description.strip() if description else None,
        price=price,
    )
    db.add(book)
    db.flush()
    identity_service.record_audit_event(
        db,
        school_id=current.school_id,
        actor_id=current.membership.user_id,
        action="book.create",
        target_type="book",
        target_id=str(book.id),
        request_id=request_id,
    )
    db.commit()
    db.refresh(book)
    return book


def update_book(
    db: Session,
    current: CurrentMembership,
    book_id: uuid.UUID,
    title: str | None,
    author: str | None,
    description: str | None,
    price: Decimal | None,
    request_id: str | None,
) -> Book:
    book = _require_book(db, current.school_id, book_id)
    if title is not None:
        clean_title = _clean_text(title)
        if not clean_title:
            raise UnprocessableError("El título no puede estar vacío.")
        book.title = clean_title
    if author is not None:
        book.author = _clean_text(author) or None
    if description is not None:
        book.description = description.strip() or None
    if price is not None:
        if price <= 0:
            raise UnprocessableError("El precio debe ser mayor que cero.")
        book.price = price

    identity_service.record_audit_event(
        db,
        school_id=current.school_id,
        actor_id=current.membership.user_id,
        action="book.update",
        target_type="book",
        target_id=str(book.id),
        request_id=request_id,
    )
    db.commit()
    db.refresh(book)
    return book


def set_book_status(
    db: Session, current: CurrentMembership, book_id: uuid.UUID, status: str, request_id: str | None
) -> Book:
    book = _require_book(db, current.school_id, book_id)
    if book.status != status:
        book.status = status
        identity_service.record_audit_event(
            db,
            school_id=current.school_id,
            actor_id=current.membership.user_id,
            action=f"book.{status}",
            target_type="book",
            target_id=str(book.id),
            request_id=request_id,
        )
        db.commit()
        db.refresh(book)
    return book


def _validate_book_upload(filename: str, content_type: str, content: bytes) -> None:
    if not filename:
        raise UnprocessableError("El archivo debe tener un nombre.")
    if content_type not in ALLOWED_BOOK_CONTENT_TYPES:
        raise UnprocessableError(
            f"Tipo de archivo no permitido: {content_type}.",
            details={"allowed": sorted(ALLOWED_BOOK_CONTENT_TYPES)},
        )
    if len(content) == 0:
        raise UnprocessableError("El archivo está vacío.")
    if len(content) > MAX_BOOK_FILE_SIZE_BYTES:
        max_mb = MAX_BOOK_FILE_SIZE_BYTES // (1024 * 1024)
        raise UnprocessableError(f"El archivo supera el máximo permitido ({max_mb}MB).")


def upload_book_file(
    db: Session,
    settings: Settings,
    current: CurrentMembership,
    book_id: uuid.UUID,
    filename: str,
    content_type: str,
    content: bytes,
    request_id: str | None,
) -> Book:
    book = _require_book(db, current.school_id, book_id)
    _validate_book_upload(filename, content_type, content)

    storage_key = (
        f"{current.school_id}/book/{book.id}/"
        f"{datetime.now(UTC).strftime('%Y%m%dT%H%M%S%f')}_{filename}"
    )
    get_storage(settings).save(storage_key, content)

    book.file_filename = filename
    book.file_content_type = content_type
    book.file_size_bytes = len(content)
    book.file_storage_key = storage_key

    identity_service.record_audit_event(
        db,
        school_id=current.school_id,
        actor_id=current.membership.user_id,
        action="book.upload_file",
        target_type="book",
        target_id=str(book.id),
        request_id=request_id,
    )
    db.commit()
    db.refresh(book)
    return book


def get_book_download(
    db: Session,
    settings: Settings,
    current: CurrentMembership,
    user_id: uuid.UUID,
    book_id: uuid.UUID,
) -> tuple[Book, str | None, bytes | None]:
    book = _require_book(db, current.school_id, book_id)
    require_book_purchase_access(db, current, user_id, book)
    if book.file_storage_key is None:
        raise NotFoundError("Este libro todavía no tiene un archivo digital cargado.")

    storage = get_storage(settings)
    url = storage.download_url(book.file_storage_key)
    if url is not None:
        return book, url, None
    return book, None, storage.read(book.file_storage_key)


def base64_encode(content: bytes) -> str:
    return base64.b64encode(content).decode("ascii")


def list_my_books(db: Session, current: CurrentMembership, user_id: uuid.UUID) -> list[Book]:
    seen: set[uuid.UUID] = set()
    result: list[Book] = []
    for student_id in _resolve_student_ids(db, current, user_id):
        for book in books_repo.list_paid_books_for_student(db, current.school_id, student_id):
            if book.id not in seen:
                seen.add(book.id)
                result.append(book)
    return result


def list_book_purchases(
    db: Session, current: CurrentMembership, book_id: uuid.UUID
) -> list[BookPurchase]:
    _require_book(db, current.school_id, book_id)
    return books_repo.list_purchases_for_book(db, current.school_id, book_id)


def record_colecturia_purchase(
    db: Session,
    current: CurrentMembership,
    user_id: uuid.UUID,
    book_id: uuid.UUID,
    student_id: uuid.UUID,
    request_id: str | None,
) -> BookPurchase:
    """El admin/colecturía ya cobró en caja: se registra directamente "paid", sin
    paso de solicitud/aprobación (confirmado con el usuario). Idempotente — si el
    alumno ya tiene este libro pagado, no se duplica (igual criterio que
    `academics.service.enroll_student_in_course`)."""
    book = _require_book(db, current.school_id, book_id)
    if book.status != "active":
        raise UnprocessableError("Este libro está archivado; no admite compras nuevas.")

    student = identity_repo.get_student_profile(db, student_id)
    if student is None or student.school_id != current.school_id:
        raise NotFoundError("El alumno indicado no existe en este colegio.")

    existing = books_repo.get_paid_purchase(db, current.school_id, book_id, student_id)
    if existing is not None:
        return existing

    purchase = BookPurchase(
        school_id=current.school_id,
        book_id=book_id,
        student_id=student_id,
        method="colecturia",
        status="paid",
        amount=book.price,
        recorded_by_user_id=user_id,
        paid_at=date.today(),
    )
    db.add(purchase)
    db.flush()
    identity_service.record_audit_event(
        db,
        school_id=current.school_id,
        actor_id=current.membership.user_id,
        action="book_purchase.colecturia",
        target_type="book_purchase",
        target_id=str(purchase.id),
        request_id=request_id,
    )
    db.commit()
    db.refresh(purchase)
    return purchase


def start_wompi_purchase(
    db: Session,
    settings: Settings,
    current: CurrentMembership,
    user_id: uuid.UUID,
    book_id: uuid.UUID,
) -> dict:
    """Crea la compra en `pending` y devuelve lo necesario para que el frontend
    redirija al Web Checkout de Wompi — no hay llamada HTTP saliente, el
    checkout funciona por redirección firmada (ver books/wompi_client.py). El
    webhook (`handle_wompi_webhook`) es quien de verdad confirma el pago."""
    book = _require_book(db, current.school_id, book_id)
    if book.status != "active":
        raise UnprocessableError("Este libro no está disponible para la compra.")
    if not settings.wompi_public_key or not settings.wompi_integrity_secret:
        raise UnprocessableError("El pago en línea con Wompi todavía no está disponible.")

    profile = identity_repo.get_student_profile_by_user(db, current.school_id, user_id)
    if profile is None:
        raise ForbiddenError("El usuario actual no tiene un perfil de alumno en este colegio.")
    if books_repo.get_paid_purchase(db, current.school_id, book_id, profile.id) is not None:
        raise UnprocessableError("Ya tienes acceso a este libro.")

    reference = f"book-{book.id}-{uuid.uuid4()}"
    amount_in_cents = int((book.price * 100).to_integral_value(rounding=ROUND_HALF_UP))
    currency = "USD"

    purchase = BookPurchase(
        school_id=current.school_id,
        book_id=book_id,
        student_id=profile.id,
        method="wompi",
        status="pending",
        amount=book.price,
        external_reference=reference,
    )
    db.add(purchase)
    db.commit()

    signature = wompi_client.build_checkout_signature(
        reference, amount_in_cents, currency, settings.wompi_integrity_secret
    )
    return {
        "reference": reference,
        "amount_in_cents": amount_in_cents,
        "currency": currency,
        "public_key": settings.wompi_public_key,
        "integrity_signature": signature,
        "checkout_base_url": settings.wompi_checkout_base_url,
    }


def handle_wompi_webhook(db: Session, settings: Settings, payload: dict) -> None:
    """Confirma o rechaza una compra `pending` según el evento recibido.
    Idempotente: un evento repetido sobre una compra ya `paid` es un no-op.
    # pragma: no cover - fórmula de firma sin verificar contra Wompi real
    (ver wompi_client.py)."""
    if not settings.wompi_events_key:
        raise UnprocessableError("Los webhooks de Wompi no están configurados todavía.")

    signature = payload.get("signature") or {}
    data = payload.get("data") or {}
    timestamp = str(payload.get("timestamp", ""))
    is_valid = wompi_client.verify_webhook_signature(
        signature.get("checksum", ""),
        signature.get("properties", []),
        data,
        timestamp,
        settings.wompi_events_key,
    )
    if not is_valid:
        raise UnprocessableError("Firma de webhook inválida.")

    transaction = data.get("transaction") or {}
    reference = transaction.get("reference")
    wompi_status = transaction.get("status")
    if not reference:
        raise UnprocessableError("El evento no trae una referencia de transacción.")

    purchase = books_repo.get_purchase_by_reference(db, reference)
    if purchase is None or purchase.status == "paid":
        return  # referencia desconocida, o evento repetido sobre una compra ya confirmada

    if wompi_status == "APPROVED":
        purchase.status = "paid"
        purchase.paid_at = date.today()
    elif wompi_status in {"DECLINED", "VOIDED", "ERROR"}:
        purchase.status = "failed"
    else:
        return  # estado intermedio (p. ej. "PENDING"): nada que actualizar todavía

    identity_service.record_audit_event(
        db,
        school_id=purchase.school_id,
        actor_id=None,
        action=f"book_purchase.wompi_{purchase.status}",
        target_type="book_purchase",
        target_id=str(purchase.id),
        request_id=None,
    )
    db.commit()
