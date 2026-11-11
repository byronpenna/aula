from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.deps import CurrentMembership, get_current_user, require_permission
from app.core.permissions import ASSIGNMENT_MANAGE, COURSE_READ, SUBMISSION_CREATE
from app.db.session import get_db
from app.modules.identity.models import User
from app.modules.learning import repository as learning_repo
from app.modules.learning import service as learning_service
from app.modules.learning.models import (
    Assignment,
    CourseCalendarEvent,
    ResourceLink,
    ResourceLinkComment,
    ResourceSection,
)
from app.modules.learning.schemas import (
    AssignmentCreate,
    AssignmentOut,
    AssignmentUpdate,
    CourseCalendarEventCreate,
    CourseCalendarEventOut,
    CourseResourcesOut,
    ResourceLinkCommentCreate,
    ResourceLinkCommentOut,
    ResourceLinkCreate,
    ResourceLinkOut,
    ResourceSectionCreate,
    ResourceSectionOut,
    ResourceSectionUpdate,
    SubmissionOut,
    SubmissionSubmitRequest,
    SubmissionUpsert,
)

router = APIRouter(tags=["learning"])


def _submission_out(submission, assignment) -> SubmissionOut:
    out = SubmissionOut.model_validate(submission)
    out.late = learning_service.is_late(assignment, submission)
    return out


@router.post("/courses/{course_id}/assignments", response_model=AssignmentOut)
def create_assignment(
    course_id: uuid.UUID,
    payload: AssignmentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    current: CurrentMembership = Depends(require_permission(ASSIGNMENT_MANAGE)),
) -> Assignment:
    return learning_service.create_assignment(db, current, user.id, course_id, payload)


@router.get("/courses/{course_id}/assignments", response_model=list[AssignmentOut])
def list_assignments(
    course_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    current: CurrentMembership = Depends(require_permission(COURSE_READ)),
) -> list[Assignment]:
    return learning_service.list_assignments(db, current, user.id, course_id)


@router.get(
    "/courses/{course_id}/calendar-events", response_model=list[CourseCalendarEventOut]
)
def list_calendar_events(
    course_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    current: CurrentMembership = Depends(require_permission(COURSE_READ)),
) -> list[CourseCalendarEvent]:
    return learning_service.list_calendar_events(db, current, user.id, course_id)


@router.post(
    "/courses/{course_id}/calendar-events", response_model=CourseCalendarEventOut
)
def create_calendar_event(
    course_id: uuid.UUID,
    payload: CourseCalendarEventCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    current: CurrentMembership = Depends(require_permission(ASSIGNMENT_MANAGE)),
) -> CourseCalendarEvent:
    return learning_service.create_calendar_event(
        db, current, user.id, course_id, payload, request.state.request_id
    )


@router.delete("/calendar-events/{event_id}", status_code=204, response_model=None)
def delete_calendar_event(
    event_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    current: CurrentMembership = Depends(require_permission(ASSIGNMENT_MANAGE)),
) -> None:
    learning_service.delete_calendar_event(db, current, user.id, event_id, request.state.request_id)


@router.patch("/assignments/{assignment_id}", response_model=AssignmentOut)
def update_assignment(
    assignment_id: uuid.UUID,
    payload: AssignmentUpdate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    current: CurrentMembership = Depends(require_permission(ASSIGNMENT_MANAGE)),
) -> Assignment:
    return learning_service.update_assignment(db, current, user.id, assignment_id, payload)


@router.post("/assignments/{assignment_id}/publish", response_model=AssignmentOut)
def publish_assignment(
    assignment_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    current: CurrentMembership = Depends(require_permission(ASSIGNMENT_MANAGE)),
) -> Assignment:
    return learning_service.publish_assignment(
        db, current, user.id, assignment_id, request.state.request_id
    )


@router.get("/assignments/{assignment_id}/my-submission", response_model=SubmissionOut | None)
def read_my_submission(
    assignment_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    current: CurrentMembership = Depends(require_permission(SUBMISSION_CREATE)),
) -> SubmissionOut | None:
    submission = learning_service.get_my_submission(db, current, user.id, assignment_id)
    if submission is None:
        return None
    assignment = learning_repo.get_assignment(db, current.school_id, assignment_id)
    return _submission_out(submission, assignment)


@router.put("/assignments/{assignment_id}/my-submission", response_model=SubmissionOut)
def upsert_my_submission(
    assignment_id: uuid.UUID,
    payload: SubmissionUpsert,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    current: CurrentMembership = Depends(require_permission(SUBMISSION_CREATE)),
) -> SubmissionOut:
    submission = learning_service.upsert_my_submission(
        db, current, user.id, assignment_id, payload.body, payload.version
    )
    assignment = learning_repo.get_assignment(
        db, current.school_id, assignment_id
    )
    return _submission_out(submission, assignment)


@router.post("/assignments/{assignment_id}/my-submission/submit", response_model=SubmissionOut)
def submit_my_submission(
    assignment_id: uuid.UUID,
    payload: SubmissionSubmitRequest,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    current: CurrentMembership = Depends(require_permission(SUBMISSION_CREATE)),
) -> SubmissionOut:
    submission = learning_service.submit_submission(
        db, current, user.id, assignment_id, payload.body, payload.version
    )
    assignment = learning_repo.get_assignment(
        db, current.school_id, assignment_id
    )
    return _submission_out(submission, assignment)


@router.get("/assignments/{assignment_id}/submissions", response_model=list[SubmissionOut])
def list_assignment_submissions(
    assignment_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    current: CurrentMembership = Depends(require_permission(COURSE_READ)),
) -> list[SubmissionOut]:
    submissions = learning_service.list_submissions_for_teacher(
        db, current, user.id, assignment_id
    )
    assignment = learning_repo.get_assignment(
        db, current.school_id, assignment_id
    )
    return [_submission_out(s, assignment) for s in submissions]


@router.get("/students/{student_id}/submissions", response_model=list[SubmissionOut])
def list_student_submissions(
    student_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    current: CurrentMembership = Depends(require_permission(COURSE_READ)),
) -> list[SubmissionOut]:
    """Consulta por padre autorizado (sección 1, primera entrega): el guardián solo
    ve datos de un alumno con vínculo activo (verificado en el service)."""
    submissions = learning_service.list_submissions_for_student(db, current, user.id, student_id)
    out = []
    for submission in submissions:
        assignment = learning_repo.get_assignment(
            db, current.school_id, submission.assignment_id
        )
        out.append(_submission_out(submission, assignment))
    return out


@router.post("/courses/{course_id}/resource-sections", response_model=ResourceSectionOut)
def create_resource_section(
    course_id: uuid.UUID,
    payload: ResourceSectionCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    current: CurrentMembership = Depends(require_permission(COURSE_READ)),
) -> ResourceSection:
    return learning_service.create_resource_section(
        db, current, user.id, course_id, payload.name, request.state.request_id
    )


@router.get("/courses/{course_id}/resource-sections", response_model=CourseResourcesOut)
def get_course_resources(
    course_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    current: CurrentMembership = Depends(require_permission(COURSE_READ)),
) -> CourseResourcesOut:
    data = learning_service.get_course_resources(db, current, user.id, course_id)
    return CourseResourcesOut(**data)


@router.patch("/resource-sections/{section_id}", response_model=ResourceSectionOut)
def rename_resource_section(
    section_id: uuid.UUID,
    payload: ResourceSectionUpdate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    current: CurrentMembership = Depends(require_permission(COURSE_READ)),
) -> ResourceSection:
    return learning_service.rename_resource_section(
        db, current, user.id, section_id, payload.name, request.state.request_id
    )


@router.delete("/resource-sections/{section_id}", response_model=ResourceSectionOut)
def delete_resource_section(
    section_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    current: CurrentMembership = Depends(require_permission(COURSE_READ)),
) -> ResourceSection:
    return learning_service.delete_resource_section(
        db, current, user.id, section_id, request.state.request_id
    )


@router.post("/resource-sections/{section_id}/links", response_model=ResourceLinkOut)
def create_resource_link(
    section_id: uuid.UUID,
    payload: ResourceLinkCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    current: CurrentMembership = Depends(require_permission(COURSE_READ)),
) -> ResourceLink:
    return learning_service.create_resource_link(
        db, current, user.id, section_id, payload, request.state.request_id
    )


@router.delete("/resource-links/{link_id}", status_code=204, response_model=None)
def delete_resource_link(
    link_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    current: CurrentMembership = Depends(require_permission(COURSE_READ)),
) -> None:
    learning_service.delete_resource_link(db, current, user.id, link_id, request.state.request_id)


@router.get("/resource-links/{link_id}/comments", response_model=list[ResourceLinkCommentOut])
def list_link_comments(
    link_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    current: CurrentMembership = Depends(require_permission(COURSE_READ)),
) -> list[ResourceLinkComment]:
    return learning_service.list_link_comments(db, current, user.id, link_id)


@router.post("/resource-links/{link_id}/comments", response_model=ResourceLinkCommentOut)
def create_link_comment(
    link_id: uuid.UUID,
    payload: ResourceLinkCommentCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    current: CurrentMembership = Depends(require_permission(COURSE_READ)),
) -> ResourceLinkComment:
    return learning_service.create_link_comment(
        db, current, user.id, link_id, payload, request.state.request_id
    )
