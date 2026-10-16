from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.learning.models import Assignment, ResourceSection, Submission, SubmissionRevision


def get_assignment(
    db: Session, school_id: uuid.UUID, assignment_id: uuid.UUID
) -> Assignment | None:
    stmt = select(Assignment).where(
        Assignment.id == assignment_id, Assignment.school_id == school_id
    )
    return db.execute(stmt).scalar_one_or_none()


def list_assignments_for_course(
    db: Session, school_id: uuid.UUID, course_id: uuid.UUID, *, published_only: bool
) -> list[Assignment]:
    stmt = select(Assignment).where(
        Assignment.school_id == school_id, Assignment.course_id == course_id
    )
    if published_only:
        stmt = stmt.where(Assignment.status == "published")
    return list(db.execute(stmt).scalars().all())


def get_submission(
    db: Session, school_id: uuid.UUID, assignment_id: uuid.UUID, student_id: uuid.UUID
) -> Submission | None:
    stmt = select(Submission).where(
        Submission.school_id == school_id,
        Submission.assignment_id == assignment_id,
        Submission.student_id == student_id,
    )
    return db.execute(stmt).scalar_one_or_none()


def get_submission_by_id(
    db: Session, school_id: uuid.UUID, submission_id: uuid.UUID
) -> Submission | None:
    stmt = select(Submission).where(
        Submission.id == submission_id, Submission.school_id == school_id
    )
    return db.execute(stmt).scalar_one_or_none()


def list_submissions_for_assignment(
    db: Session, school_id: uuid.UUID, assignment_id: uuid.UUID
) -> list[Submission]:
    stmt = select(Submission).where(
        Submission.school_id == school_id, Submission.assignment_id == assignment_id
    )
    return list(db.execute(stmt).scalars().all())


def list_submissions_for_student(
    db: Session, school_id: uuid.UUID, student_id: uuid.UUID
) -> list[Submission]:
    stmt = select(Submission).where(
        Submission.school_id == school_id, Submission.student_id == student_id
    )
    return list(db.execute(stmt).scalars().all())


def list_resource_sections(
    db: Session, school_id: uuid.UUID, course_id: uuid.UUID
) -> list[ResourceSection]:
    stmt = select(ResourceSection).where(
        ResourceSection.school_id == school_id, ResourceSection.course_id == course_id
    ).order_by(ResourceSection.created_at)
    return list(db.execute(stmt).scalars().all())


def get_resource_section(
    db: Session, school_id: uuid.UUID, section_id: uuid.UUID
) -> ResourceSection | None:
    stmt = select(ResourceSection).where(
        ResourceSection.id == section_id, ResourceSection.school_id == school_id
    )
    return db.execute(stmt).scalar_one_or_none()


def next_revision_number(db: Session, submission_id: uuid.UUID) -> int:
    stmt = select(SubmissionRevision.revision_number).where(
        SubmissionRevision.submission_id == submission_id
    ).order_by(SubmissionRevision.revision_number.desc())
    last = db.execute(stmt).scalars().first()
    return (last or 0) + 1
