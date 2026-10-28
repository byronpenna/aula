from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Request, Response, UploadFile
from fastapi import File as FastAPIFile
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.deps import (
    CurrentMembership,
    get_current_membership,
    get_current_user,
    require_permission,
)
from app.core.permissions import BOOKS_MANAGE, BOOKS_READ
from app.db.session import get_db
from app.modules.books import service as books_service
from app.modules.books.models import Book
from app.modules.books.schemas import (
    BookCreate,
    BookFileVersionOut,
    BookOut,
    BookPurchaseOut,
    BookUpdate,
    ColecturiaPurchaseCreate,
    WompiCheckoutOut,
)
from app.modules.identity import repository as identity_repo
from app.modules.identity.models import User
from app.modules.identity.schemas import StudentProfileOut

router = APIRouter(tags=["books"])
# Sin prefijo /api/v1 a propósito (igual que public_site_public_router en
# main.py): en infra/lib/api-stack.ts esta ruta va sin autorizador de Cognito,
# porque la llama el servidor de Wompi, no un usuario autenticado.
webhook_router = APIRouter(tags=["books-webhooks"])


def _book_out(book: Book, owned: bool) -> BookOut:
    out = BookOut.model_validate(book)
    out.owned = owned
    return out


def _purchase_out(db: Session, school_id: uuid.UUID, purchase) -> BookPurchaseOut:
    out = BookPurchaseOut.model_validate(purchase)
    student = identity_repo.get_student_profile(db, purchase.student_id)
    if student is not None and student.user_id is not None:
        user = identity_repo.get_user(db, student.user_id)
        out.student_display_name = user.display_name if user is not None else None
    return out


@router.get("/books", response_model=list[BookOut])
def list_books(
    include_archived: bool = False,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    current: CurrentMembership = Depends(require_permission(BOOKS_READ)),
):
    rows = books_service.list_catalog(db, current, user.id, include_archived=include_archived)
    return [_book_out(book, owned) for book, owned in rows]


@router.get("/books/students", response_model=list[StudentProfileOut])
def list_student_candidates(
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(BOOKS_MANAGE)),
):
    """Lista de alumnos del colegio para elegir a quién registrarle una compra por
    colecturía (sección nueva): deliberadamente gateada por `books:manage` en vez
    de reutilizar `GET /students` (que exige `enrollment:manage`, permiso que
    `finance` no tiene por defecto — ver core/permissions.py)."""
    rows = identity_repo.list_student_profiles(db, current.school_id)
    return [
        StudentProfileOut(id=profile.id, student_number=profile.student_number, display_name=name)
        for profile, name in rows
    ]


@router.get("/books/{book_id}", response_model=BookOut)
def get_book(
    book_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    current: CurrentMembership = Depends(require_permission(BOOKS_READ)),
):
    book, owned = books_service.get_book_detail(db, current, user.id, book_id)
    return _book_out(book, owned)


@router.post("/books", response_model=BookOut)
def create_book(
    payload: BookCreate,
    request: Request,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(BOOKS_MANAGE)),
):
    book = books_service.create_book(
        db, current, payload.title, payload.author, payload.description, payload.price,
        request.state.request_id,
    )
    return _book_out(book, owned=False)


@router.patch("/books/{book_id}", response_model=BookOut)
def update_book(
    book_id: uuid.UUID,
    payload: BookUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(BOOKS_MANAGE)),
):
    book = books_service.update_book(
        db, current, book_id, payload.title, payload.author, payload.description, payload.price,
        request.state.request_id,
    )
    return _book_out(book, owned=False)


@router.post("/books/{book_id}/archive", response_model=BookOut)
def archive_book(
    book_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(BOOKS_MANAGE)),
):
    book = books_service.set_book_status(db, current, book_id, "archived", request.state.request_id)
    return _book_out(book, owned=False)


@router.post("/books/{book_id}/activate", response_model=BookOut)
def activate_book(
    book_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(BOOKS_MANAGE)),
):
    book = books_service.set_book_status(db, current, book_id, "active", request.state.request_id)
    return _book_out(book, owned=False)


@router.post("/books/{book_id}/file", response_model=BookOut)
async def upload_book_file(
    book_id: uuid.UUID,
    request: Request,
    upload: UploadFile = FastAPIFile(...),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    current: CurrentMembership = Depends(require_permission(BOOKS_MANAGE)),
):
    content = await upload.read()
    book = books_service.upload_book_file(
        db, settings, current, book_id,
        upload.filename or "libro",
        upload.content_type or "application/octet-stream",
        content,
        request.state.request_id,
    )
    return _book_out(book, owned=False)


@router.get("/books/{book_id}/versions", response_model=list[BookFileVersionOut])
def list_book_file_versions(
    book_id: uuid.UUID,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(BOOKS_MANAGE)),
):
    versions = books_service.list_book_file_versions(db, current, book_id)
    return [BookFileVersionOut.model_validate(v) for v in versions]


@router.post("/books/{book_id}/versions/{version_id}/activate", response_model=BookOut)
def activate_book_file_version(
    book_id: uuid.UUID,
    version_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(BOOKS_MANAGE)),
):
    book = books_service.activate_book_file_version(
        db, current, book_id, version_id, request.state.request_id
    )
    return _book_out(book, owned=False)


@router.post("/books/{book_id}/versions/{version_id}/deactivate", response_model=BookOut)
def deactivate_book_file_version(
    book_id: uuid.UUID,
    version_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(BOOKS_MANAGE)),
):
    book = books_service.deactivate_book_file_version(
        db, current, book_id, version_id, request.state.request_id
    )
    return _book_out(book, owned=False)


@router.get("/books/{book_id}/content")
def get_book_content(
    book_id: uuid.UUID,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    user: User = Depends(get_current_user),
    current: CurrentMembership = Depends(get_current_membership),
):
    """Nunca una URL firmada (sección nueva, confirmado con el usuario: los
    libros no se descargan): los bytes siempre viajan por este endpoint con
    JWT vigente. `inline` + `no-store` refuerzan "ver, no guardar" del lado del
    navegador, aunque el control real es que el frontend nunca ofrece un
    enlace de descarga — ver books/service.py::get_book_content."""
    book, content = books_service.get_book_content(db, settings, current, user.id, book_id)
    return Response(
        content=content,
        media_type=book.file_content_type or "application/octet-stream",
        headers={
            "Content-Disposition": f'inline; filename="{book.file_filename}"',
            "Cache-Control": "private, no-store",
        },
    )


@router.get("/me/books", response_model=list[BookOut])
def list_my_books(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    current: CurrentMembership = Depends(get_current_membership),
):
    books = books_service.list_my_books(db, current, user.id)
    return [_book_out(book, owned=True) for book in books]


@router.get("/books/{book_id}/purchases", response_model=list[BookPurchaseOut])
def list_book_purchases(
    book_id: uuid.UUID,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(BOOKS_MANAGE)),
):
    purchases = books_service.list_book_purchases(db, current, book_id)
    return [_purchase_out(db, current.school_id, p) for p in purchases]


@router.post("/books/{book_id}/purchases/colecturia", response_model=BookPurchaseOut)
def record_colecturia_purchase(
    book_id: uuid.UUID,
    payload: ColecturiaPurchaseCreate,
    request: Request,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(BOOKS_MANAGE)),
):
    purchase = books_service.record_colecturia_purchase(
        db, current, current.membership.user_id, book_id, payload.student_id,
        request.state.request_id,
    )
    return _purchase_out(db, current.school_id, purchase)


@router.post("/books/{book_id}/purchases/wompi", response_model=WompiCheckoutOut)
def start_wompi_purchase(
    book_id: uuid.UUID,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    user: User = Depends(get_current_user),
    current: CurrentMembership = Depends(require_permission(BOOKS_READ)),
):
    checkout = books_service.start_wompi_purchase(db, settings, current, user.id, book_id)
    return WompiCheckoutOut(**checkout)


@webhook_router.post("/webhooks/wompi", status_code=204)
async def wompi_webhook(
    request: Request,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    payload = await request.json()
    books_service.handle_wompi_webhook(db, settings, payload)
