from __future__ import annotations

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.modules.learning.models import (
    Assignment,
    CourseCalendarEvent,
    CoursePost,
    CoursePostComment,
    CoursePostPoll,
    CoursePostPollOption,
    CoursePostPollVote,
    ResourceLink,
    ResourceLinkComment,
    ResourceSection,
    Submission,
    SubmissionRevision,
)


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


def list_calendar_events(
    db: Session, school_id: uuid.UUID, course_id: uuid.UUID
) -> list[CourseCalendarEvent]:
    stmt = select(CourseCalendarEvent).where(
        CourseCalendarEvent.school_id == school_id, CourseCalendarEvent.course_id == course_id
    ).order_by(CourseCalendarEvent.event_date)
    return list(db.execute(stmt).scalars().all())


def get_calendar_event(
    db: Session, school_id: uuid.UUID, event_id: uuid.UUID
) -> CourseCalendarEvent | None:
    stmt = select(CourseCalendarEvent).where(
        CourseCalendarEvent.id == event_id, CourseCalendarEvent.school_id == school_id
    )
    return db.execute(stmt).scalar_one_or_none()


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


def list_resource_links(
    db: Session, school_id: uuid.UUID, resource_section_id: uuid.UUID
) -> list[ResourceLink]:
    stmt = select(ResourceLink).where(
        ResourceLink.school_id == school_id,
        ResourceLink.resource_section_id == resource_section_id,
    ).order_by(ResourceLink.created_at)
    return list(db.execute(stmt).scalars().all())


def get_resource_link(
    db: Session, school_id: uuid.UUID, link_id: uuid.UUID
) -> ResourceLink | None:
    stmt = select(ResourceLink).where(
        ResourceLink.id == link_id, ResourceLink.school_id == school_id
    )
    return db.execute(stmt).scalar_one_or_none()


def list_link_comments(
    db: Session, school_id: uuid.UUID, resource_link_id: uuid.UUID
) -> list[ResourceLinkComment]:
    stmt = select(ResourceLinkComment).where(
        ResourceLinkComment.school_id == school_id,
        ResourceLinkComment.resource_link_id == resource_link_id,
    ).order_by(ResourceLinkComment.created_at)
    return list(db.execute(stmt).scalars().all())


def delete_link_comments(db: Session, resource_link_id: uuid.UUID) -> None:
    stmt = select(ResourceLinkComment).where(
        ResourceLinkComment.resource_link_id == resource_link_id
    )
    for comment in db.execute(stmt).scalars().all():
        db.delete(comment)


def list_course_posts(db: Session, school_id: uuid.UUID, course_id: uuid.UUID) -> list[CoursePost]:
    stmt = select(CoursePost).where(
        CoursePost.school_id == school_id, CoursePost.course_id == course_id
    ).order_by(CoursePost.created_at.desc())
    return list(db.execute(stmt).scalars().all())


def get_course_post(db: Session, school_id: uuid.UUID, post_id: uuid.UUID) -> CoursePost | None:
    stmt = select(CoursePost).where(CoursePost.id == post_id, CoursePost.school_id == school_id)
    return db.execute(stmt).scalar_one_or_none()


def list_post_comments(
    db: Session, school_id: uuid.UUID, post_id: uuid.UUID
) -> list[CoursePostComment]:
    stmt = select(CoursePostComment).where(
        CoursePostComment.school_id == school_id, CoursePostComment.post_id == post_id
    ).order_by(CoursePostComment.created_at)
    return list(db.execute(stmt).scalars().all())


def count_post_comments(db: Session, school_id: uuid.UUID, post_id: uuid.UUID) -> int:
    stmt = select(func.count()).select_from(CoursePostComment).where(
        CoursePostComment.school_id == school_id, CoursePostComment.post_id == post_id
    )
    return db.execute(stmt).scalar_one()


def delete_post_comments(db: Session, post_id: uuid.UUID) -> None:
    stmt = select(CoursePostComment).where(CoursePostComment.post_id == post_id)
    for comment in db.execute(stmt).scalars().all():
        db.delete(comment)


def get_poll_by_post(
    db: Session, school_id: uuid.UUID, post_id: uuid.UUID
) -> CoursePostPoll | None:
    stmt = select(CoursePostPoll).where(
        CoursePostPoll.school_id == school_id, CoursePostPoll.post_id == post_id
    )
    return db.execute(stmt).scalar_one_or_none()


def get_poll(db: Session, school_id: uuid.UUID, poll_id: uuid.UUID) -> CoursePostPoll | None:
    stmt = select(CoursePostPoll).where(
        CoursePostPoll.id == poll_id, CoursePostPoll.school_id == school_id
    )
    return db.execute(stmt).scalar_one_or_none()


def list_poll_options(
    db: Session, school_id: uuid.UUID, poll_id: uuid.UUID
) -> list[CoursePostPollOption]:
    stmt = select(CoursePostPollOption).where(
        CoursePostPollOption.school_id == school_id, CoursePostPollOption.poll_id == poll_id
    ).order_by(CoursePostPollOption.position)
    return list(db.execute(stmt).scalars().all())


def get_poll_option(
    db: Session, school_id: uuid.UUID, option_id: uuid.UUID
) -> CoursePostPollOption | None:
    stmt = select(CoursePostPollOption).where(
        CoursePostPollOption.id == option_id, CoursePostPollOption.school_id == school_id
    )
    return db.execute(stmt).scalar_one_or_none()


def list_votes_for_options(
    db: Session, option_ids: list[uuid.UUID]
) -> list[CoursePostPollVote]:
    if not option_ids:
        return []
    stmt = select(CoursePostPollVote).where(CoursePostPollVote.poll_option_id.in_(option_ids))
    return list(db.execute(stmt).scalars().all())


def delete_votes_by_voter(
    db: Session, option_ids: list[uuid.UUID], voter_user_id: uuid.UUID
) -> None:
    if not option_ids:
        return
    stmt = select(CoursePostPollVote).where(
        CoursePostPollVote.poll_option_id.in_(option_ids),
        CoursePostPollVote.voter_user_id == voter_user_id,
    )
    for vote in db.execute(stmt).scalars().all():
        db.delete(vote)


def delete_poll_cascade(db: Session, poll_id: uuid.UUID) -> None:
    """Borra las opciones de la encuesta y sus votos antes que la encuesta
    misma (orden obligatorio por las FK) — se usa al borrar la publicación
    completa, nunca de forma aislada."""
    options = list(
        db.execute(
            select(CoursePostPollOption).where(CoursePostPollOption.poll_id == poll_id)
        ).scalars()
    )
    option_ids = [o.id for o in options]
    if option_ids:
        votes = db.execute(
            select(CoursePostPollVote).where(CoursePostPollVote.poll_option_id.in_(option_ids))
        ).scalars()
        for vote in votes:
            db.delete(vote)
        db.flush()  # fuerza el DELETE de votos antes del de opciones (FK)
    for option in options:
        db.delete(option)
    db.flush()  # fuerza el DELETE de opciones antes del de la encuesta (FK)


def next_revision_number(db: Session, submission_id: uuid.UUID) -> int:
    stmt = select(SubmissionRevision.revision_number).where(
        SubmissionRevision.submission_id == submission_id
    ).order_by(SubmissionRevision.revision_number.desc())
    last = db.execute(stmt).scalars().first()
    return (last or 0) + 1
