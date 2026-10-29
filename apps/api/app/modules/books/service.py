"""Reglas de negocio del catálogo de libros y sus compras (módulo nuevo).

Regla universal (sección 6): el catálogo (título, autor, precio) es de lectura
abierta a cualquiera con el permiso `books:read`; lo único gateado por compra es
el contenido — ver `require_book_purchase_access`/`get_book_content`, mismo
criterio "404 si no hay acceso" que `files/service.py::get_download`.

`get_book_content` nunca usa `storage.download_url()` (a diferencia de
`files/service.py`): los libros no deben poder descargarse vía un enlace que
funcione fuera de sesión (confirmado con el usuario), así que siempre lee los
bytes y los sirve por este mismo endpoint autenticado — ver
`books/router.py::get_book_content`.
"""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.deps import CurrentMembership
from app.core.errors import ForbiddenError, NotFoundError, UnprocessableError
from app.modules.books import repository as books_repo
from app.modules.books import wompi_client
from app.modules.books.models import Book, BookAnnotation, BookFileVersion, BookPurchase
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


# content_type "genérico" que el navegador manda cuando no tiene registrado el
# tipo MIME real en el sistema operativo — pasa seguido con .epub (mucho menos
# reconocido que .pdf en las tablas mime.types de muchos navegadores/SO).
_GENERIC_CONTENT_TYPES = {"application/octet-stream", ""}
_EXTENSION_CONTENT_TYPES = {
    ".pdf": "application/pdf",
    ".epub": "application/epub+zip",
}


def _resolve_content_type(filename: str, content_type: str) -> str:
    """Si el navegador no reconoció el tipo MIME real (sección nueva: .epub es
    un caso común), se infiere por la extensión del archivo antes de validar —
    de lo contrario un EPUB válido se rechazaría solo por una limitación del
    navegador/SO, no del archivo en sí."""
    if content_type not in _GENERIC_CONTENT_TYPES:
        return content_type
    for extension, resolved in _EXTENSION_CONTENT_TYPES.items():
        if filename.lower().endswith(extension):
            return resolved
    return content_type


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


def _sync_active_file_onto_book(book: Book, version: BookFileVersion) -> None:
    """Denormaliza la versión activa sobre `Book.file_*` (sección nueva: versiones
    de archivo) para que `get_book_content`/`BookOut` sigan leyendo esas columnas
    sin enterarse de que ahora hay un historial detrás."""
    book.file_filename = version.filename
    book.file_content_type = version.content_type
    book.file_size_bytes = version.size_bytes
    book.file_storage_key = version.storage_key


def _clear_active_file_on_book(book: Book) -> None:
    book.file_filename = None
    book.file_content_type = None
    book.file_size_bytes = None
    book.file_storage_key = None


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
    """Cada subida agrega una versión nueva al historial (sección nueva: gestión
    de versiones), nunca sobrescribe la anterior. Si el libro todavía no tiene
    ninguna versión activa (primera subida, o la activa fue desactivada sin
    reemplazo) esta se activa automáticamente para no romper el flujo existente
    de "subir y quedar listo para leer"; en cualquier otro caso queda inactiva y
    el staff decide cuándo activarla desde `activate_book_file_version`."""
    book = _require_book(db, current.school_id, book_id)
    content_type = _resolve_content_type(filename, content_type)
    _validate_book_upload(filename, content_type, content)

    storage_key = (
        f"{current.school_id}/book/{book.id}/"
        f"{datetime.now(UTC).strftime('%Y%m%dT%H%M%S%f')}_{filename}"
    )
    get_storage(settings).save(storage_key, content)

    has_active = books_repo.get_active_file_version(db, current.school_id, book.id) is not None
    version = BookFileVersion(
        school_id=current.school_id,
        book_id=book.id,
        filename=filename,
        content_type=content_type,
        size_bytes=len(content),
        storage_key=storage_key,
        is_active=not has_active,
        uploaded_by_user_id=current.membership.user_id,
    )
    db.add(version)
    db.flush()
    if not has_active:
        _sync_active_file_onto_book(book, version)

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


def list_book_file_versions(
    db: Session, current: CurrentMembership, book_id: uuid.UUID
) -> list[BookFileVersion]:
    _require_book(db, current.school_id, book_id)
    return books_repo.list_file_versions(db, current.school_id, book_id)


def _require_file_version(
    db: Session, school_id: uuid.UUID, book_id: uuid.UUID, version_id: uuid.UUID
) -> BookFileVersion:
    version = books_repo.get_file_version(db, school_id, book_id, version_id)
    if version is None:
        raise NotFoundError("La versión indicada no existe para este libro.")
    return version


def activate_book_file_version(
    db: Session,
    current: CurrentMembership,
    book_id: uuid.UUID,
    version_id: uuid.UUID,
    request_id: str | None,
) -> Book:
    book = _require_book(db, current.school_id, book_id)
    version = _require_file_version(db, current.school_id, book.id, version_id)
    if not version.is_active:
        books_repo.deactivate_all_file_versions(db, current.school_id, book.id)
        version.is_active = True
        _sync_active_file_onto_book(book, version)
        identity_service.record_audit_event(
            db,
            school_id=current.school_id,
            actor_id=current.membership.user_id,
            action="book.activate_version",
            target_type="book_file_version",
            target_id=str(version.id),
            request_id=request_id,
        )
        db.commit()
        db.refresh(book)
    return book


def deactivate_book_file_version(
    db: Session,
    current: CurrentMembership,
    book_id: uuid.UUID,
    version_id: uuid.UUID,
    request_id: str | None,
) -> Book:
    """Deja al libro sin archivo legible si la versión desactivada era la activa
    (sección nueva): es una decisión deliberada del staff, no un error — el
    catálogo sigue mostrando el libro, pero `get_book_content` vuelve a responder
    "todavía no tiene un archivo digital cargado" hasta que se active otra."""
    book = _require_book(db, current.school_id, book_id)
    version = _require_file_version(db, current.school_id, book.id, version_id)
    if version.is_active:
        version.is_active = False
        _clear_active_file_on_book(book)
        identity_service.record_audit_event(
            db,
            school_id=current.school_id,
            actor_id=current.membership.user_id,
            action="book.deactivate_version",
            target_type="book_file_version",
            target_id=str(version.id),
            request_id=request_id,
        )
        db.commit()
        db.refresh(book)
    return book


def get_book_content(
    db: Session,
    settings: Settings,
    current: CurrentMembership,
    user_id: uuid.UUID,
    book_id: uuid.UUID,
) -> tuple[Book, bytes]:
    """Siempre devuelve los bytes del archivo (nunca una URL firmada): el único
    camino para leer un libro es este endpoint con JWT vigente, no un enlace
    compartible fuera de sesión (ver books/router.py::get_book_content)."""
    book = _require_book(db, current.school_id, book_id)
    require_book_purchase_access(db, current, user_id, book)
    if book.file_storage_key is None:
        raise NotFoundError("Este libro todavía no tiene un archivo digital cargado.")

    return book, get_storage(settings).read(book.file_storage_key)


ANNOTATION_KINDS = {"note", "highlight"}
ANNOTATION_COLORS = {"yellow", "green", "blue", "pink"}


def _validate_rect(rect: dict) -> None:
    for key in ("x", "y", "width", "height"):
        value = rect.get(key)
        if not isinstance(value, int | float) or not (0 <= value <= 1):
            raise UnprocessableError(
                "Cada recuadro de resaltado debe tener x/y/width/height entre 0 y 1."
            )


def create_book_annotation(
    db: Session,
    current: CurrentMembership,
    user_id: uuid.UUID,
    book_id: uuid.UUID,
    payload: dict,
    request_id: str | None,
) -> BookAnnotation:
    """Una anotación siempre nace de una selección de texto (sección nueva: no
    hay notas "de punto libre" sin seleccionar nada, para no duplicar dos
    interacciones distintas en el lector) — por eso PDF siempre requiere
    `rects` (uno por línea de la selección) y EPUB siempre `cfi_range`, nunca
    ambos. `x`/`y` del primer recuadro se derivan acá, solo como ancla de
    conveniencia para que el frontend posicione el marcador/ordene la lista."""
    book = _require_book(db, current.school_id, book_id)
    require_book_purchase_access(db, current, user_id, book)

    kind = payload.get("kind")
    if kind not in ANNOTATION_KINDS:
        raise UnprocessableError(
            "kind debe ser 'note' o 'highlight'.", details={"allowed": sorted(ANNOTATION_KINDS)}
        )

    page_number = payload.get("page_number")
    rects = payload.get("rects")
    cfi_range = payload.get("cfi_range")
    if cfi_range and (page_number is not None or rects):
        raise UnprocessableError(
            "Una anotación es de PDF (page_number + rects) o de EPUB (cfi_range), no ambos."
        )

    color = payload.get("color")
    body = (payload.get("body") or "").strip() or None

    if kind == "highlight":
        if not color or color not in ANNOTATION_COLORS:
            raise UnprocessableError(
                "Un resaltado requiere un color válido.",
                details={"allowed": sorted(ANNOTATION_COLORS)},
            )
    else:
        color = None
        if not body:
            raise UnprocessableError("La nota no puede estar vacía.")

    x = y = None
    if cfi_range:
        rects = None
        page_number = None
    else:
        if page_number is None or page_number < 1:
            raise UnprocessableError("page_number debe ser mayor o igual a 1.")
        if not rects:
            raise UnprocessableError("Se requiere al menos un recuadro de la selección (rects).")
        for rect in rects:
            _validate_rect(rect)
        x, y = rects[0]["x"], rects[0]["y"]

    annotation = BookAnnotation(
        school_id=current.school_id,
        book_id=book.id,
        author_user_id=user_id,
        kind=kind,
        color=color,
        body=body,
        is_shared=bool(payload.get("is_shared", False)),
        page_number=page_number,
        x=x,
        y=y,
        rects=rects,
        cfi_range=cfi_range,
    )
    db.add(annotation)
    db.flush()
    identity_service.record_audit_event(
        db,
        school_id=current.school_id,
        actor_id=current.membership.user_id,
        action="book_annotation.create",
        target_type="book_annotation",
        target_id=str(annotation.id),
        request_id=request_id,
    )
    db.commit()
    db.refresh(annotation)
    return annotation


def list_book_annotations(
    db: Session, current: CurrentMembership, user_id: uuid.UUID, book_id: uuid.UUID
) -> list[BookAnnotation]:
    book = _require_book(db, current.school_id, book_id)
    require_book_purchase_access(db, current, user_id, book)
    return books_repo.list_annotations_for_reader(db, current.school_id, book_id, user_id)


def update_book_annotation(
    db: Session,
    current: CurrentMembership,
    user_id: uuid.UUID,
    book_id: uuid.UUID,
    annotation_id: uuid.UUID,
    body: str | None,
    color: str | None,
    is_shared: bool | None,
    request_id: str | None,
) -> BookAnnotation:
    """Solo el autor puede editar la suya — nunca 403: un `annotation_id` ajeno o
    inexistente se ve igual (404), mismo criterio que el resto del módulo."""
    annotation = books_repo.get_own_annotation(
        db, current.school_id, book_id, user_id, annotation_id
    )
    if annotation is None:
        raise NotFoundError("La anotación indicada no existe.")

    if body is not None:
        clean_body = body.strip()
        if annotation.kind == "note" and not clean_body:
            raise UnprocessableError("La nota no puede estar vacía.")
        annotation.body = clean_body or None
    if color is not None:
        if annotation.kind != "highlight":
            raise UnprocessableError("Solo un resaltado puede tener color.")
        if color not in ANNOTATION_COLORS:
            raise UnprocessableError(
                "Color inválido.", details={"allowed": sorted(ANNOTATION_COLORS)}
            )
        annotation.color = color
    if is_shared is not None:
        annotation.is_shared = is_shared

    identity_service.record_audit_event(
        db,
        school_id=current.school_id,
        actor_id=current.membership.user_id,
        action="book_annotation.update",
        target_type="book_annotation",
        target_id=str(annotation.id),
        request_id=request_id,
    )
    db.commit()
    db.refresh(annotation)
    return annotation


def delete_book_annotation(
    db: Session,
    current: CurrentMembership,
    user_id: uuid.UUID,
    book_id: uuid.UUID,
    annotation_id: uuid.UUID,
    request_id: str | None,
) -> None:
    annotation = books_repo.get_own_annotation(
        db, current.school_id, book_id, user_id, annotation_id
    )
    if annotation is None:
        raise NotFoundError("La anotación indicada no existe.")

    identity_service.record_audit_event(
        db,
        school_id=current.school_id,
        actor_id=current.membership.user_id,
        action="book_annotation.delete",
        target_type="book_annotation",
        target_id=str(annotation.id),
        request_id=request_id,
    )
    db.delete(annotation)
    db.commit()


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
