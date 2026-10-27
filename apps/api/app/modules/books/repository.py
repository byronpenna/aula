from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.books.models import Book, BookPurchase


def list_books(db: Session, school_id: uuid.UUID, *, include_archived: bool) -> list[Book]:
    stmt = select(Book).where(Book.school_id == school_id)
    if not include_archived:
        stmt = stmt.where(Book.status == "active")
    return list(db.execute(stmt.order_by(Book.title)).scalars().all())


def get_book(db: Session, school_id: uuid.UUID, book_id: uuid.UUID) -> Book | None:
    stmt = select(Book).where(Book.id == book_id, Book.school_id == school_id)
    return db.execute(stmt).scalar_one_or_none()


def get_paid_purchase(
    db: Session, school_id: uuid.UUID, book_id: uuid.UUID, student_id: uuid.UUID
) -> BookPurchase | None:
    stmt = select(BookPurchase).where(
        BookPurchase.school_id == school_id,
        BookPurchase.book_id == book_id,
        BookPurchase.student_id == student_id,
        BookPurchase.status == "paid",
    )
    return db.execute(stmt).scalar_one_or_none()


def get_purchase_by_reference(db: Session, external_reference: str) -> BookPurchase | None:
    """Sin filtro de `school_id` a propósito: la llama el webhook público de Wompi
    (books/service.py::handle_wompi_webhook), que no tiene una membresía/colegio
    actual — `external_reference` ya es único globalmente (UniqueConstraint en
    el modelo), así que basta para encontrar la compra correcta."""
    stmt = select(BookPurchase).where(BookPurchase.external_reference == external_reference)
    return db.execute(stmt).scalar_one_or_none()


def list_purchases_for_book(
    db: Session, school_id: uuid.UUID, book_id: uuid.UUID
) -> list[BookPurchase]:
    stmt = (
        select(BookPurchase)
        .where(BookPurchase.school_id == school_id, BookPurchase.book_id == book_id)
        .order_by(BookPurchase.created_at.desc())
    )
    return list(db.execute(stmt).scalars().all())


def list_paid_books_for_student(
    db: Session, school_id: uuid.UUID, student_id: uuid.UUID
) -> list[Book]:
    stmt = (
        select(Book)
        .join(BookPurchase, BookPurchase.book_id == Book.id)
        .where(
            Book.school_id == school_id,
            BookPurchase.school_id == school_id,
            BookPurchase.student_id == student_id,
            BookPurchase.status == "paid",
        )
        .order_by(Book.title)
    )
    return list(db.execute(stmt).scalars().all())
