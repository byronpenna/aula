from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.files.models import File, FileNote


def list_files(
    db: Session, school_id: uuid.UUID, attached_to_type: str, attached_to_id: uuid.UUID
) -> list[File]:
    stmt = select(File).where(
        File.school_id == school_id,
        File.attached_to_type == attached_to_type,
        File.attached_to_id == attached_to_id,
    ).order_by(File.created_at)
    return list(db.execute(stmt).scalars().all())


def get_file(db: Session, school_id: uuid.UUID, file_id: uuid.UUID) -> File | None:
    stmt = select(File).where(File.id == file_id, File.school_id == school_id)
    return db.execute(stmt).scalar_one_or_none()


def list_notes(db: Session, school_id: uuid.UUID, file_id: uuid.UUID) -> list[FileNote]:
    stmt = select(FileNote).where(
        FileNote.school_id == school_id, FileNote.file_id == file_id
    ).order_by(FileNote.page_number, FileNote.created_at)
    return list(db.execute(stmt).scalars().all())


def get_note(db: Session, school_id: uuid.UUID, note_id: uuid.UUID) -> FileNote | None:
    stmt = select(FileNote).where(FileNote.id == note_id, FileNote.school_id == school_id)
    return db.execute(stmt).scalar_one_or_none()
