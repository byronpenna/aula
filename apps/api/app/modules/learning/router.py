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
from app.modules.learning.models import Assignment
from app.modules.learning.schemas import (
    AssignmentCreate,
    AssignmentOut,
    AssignmentUpdate,
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
