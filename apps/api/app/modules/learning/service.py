"""Reglas de negocio de tareas y entregas (sección 9, "Publicar y entregar tarea").

Regla universal (sección 6): toda operación valida colegio + permiso + vínculo con el
curso/alumno antes de tocar datos, reutilizando `academics.service` para eso.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.core.deps import CurrentMembership
from app.core.errors import ConflictError, NotFoundError, UnprocessableError
from app.modules.academics import repository as academics_repo
from app.modules.academics import service as academics_service
from app.modules.identity import repository as identity_repo
from app.modules.identity import service as identity_service
from app.modules.learning import repository as learning_repo
from app.modules.learning.models import Assignment, Submission, SubmissionRevision
from app.modules.learning.schemas import AssignmentCreate, AssignmentUpdate


def _require_course(db: Session, current: CurrentMembership, course_id: uuid.UUID):
    course = academics_repo.get_course(db, current.school_id, course_id)
    if course is None:
        raise NotFoundError("El curso indicado no existe en este colegio.")
    return course


def create_assignment(
    db: Session,
    current: CurrentMembership,
    user_id: uuid.UUID,
    course_id: uuid.UUID,
    payload: AssignmentCreate,
) -> Assignment:
    course = _require_course(db, current, course_id)
    academics_service.require_course_access(db, current, user_id, course)
    if course.status == "archived":
        raise UnprocessableError("El curso está archivado; no admite tareas nuevas.")
    if payload.max_score <= 0:
        raise UnprocessableError("max_score debe ser mayor que cero.")

    assignment = Assignment(
        school_id=current.school_id,
        course_id=course_id,
        title=payload.title,
        instructions=payload.instructions,
        due_at=payload.due_at,
        max_score=payload.max_score,
        allow_late=payload.allow_late,
        status="draft",
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return assignment


def update_assignment(
    db: Session,
    current: CurrentMembership,
    user_id: uuid.UUID,
    assignment_id: uuid.UUID,
    payload: AssignmentUpdate,
) -> Assignment:
    assignment = learning_repo.get_assignment(db, current.school_id, assignment_id)
    if assignment is None:
        raise NotFoundError("La tarea indicada no existe en este colegio.")
    course = _require_course(db, current, assignment.course_id)
    academics_service.require_course_access(db, current, user_id, course)
    if assignment.status == "published" and (
        payload.max_score is not None or payload.due_at is not None
    ):
        raise ConflictError(
            "No se puede cambiar max_score/due_at de una tarea ya publicada; "
            "crea una nueva o coordina con los alumnos."
        )

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(assignment, field, value)
    db.commit()
    db.refresh(assignment)
    return assignment


def publish_assignment(
    db: Session, current: CurrentMembership, user_id: uuid.UUID, assignment_id: uuid.UUID,
    request_id: str | None,
) -> Assignment:
    """Publicar valida fechas, curso y max_score (sección 9). El evento outbox para
    notificaciones queda para la fase 5 (avisos/reportes); aquí solo se registra
    auditoría de la publicación."""
    assignment = learning_repo.get_assignment(db, current.school_id, assignment_id)
    if assignment is None:
        raise NotFoundError("La tarea indicada no existe en este colegio.")
    course = _require_course(db, current, assignment.course_id)
    academics_service.require_course_access(db, current, user_id, course)

    if assignment.max_score <= 0:
        raise UnprocessableError("max_score debe ser mayor que cero antes de publicar.")
    if assignment.status == "published":
        raise ConflictError("La tarea ya está publicada.")

    assignment.status = "published"
    identity_service.record_audit_event(
        db,
        school_id=current.school_id,
        actor_id=current.membership.user_id,
        action="assignment.publish",
        target_type="assignment",
        target_id=str(assignment.id),
        request_id=request_id,
    )
    db.commit()
    db.refresh(assignment)
    return assignment


def list_assignments(
    db: Session, current: CurrentMembership, user_id: uuid.UUID, course_id: uuid.UUID
) -> list[Assignment]:
    course = _require_course(db, current, course_id)
    academics_service.require_course_access(db, current, user_id, course)
    # Alumno matriculado ve únicamente contenido publicado (sección 9).
    published_only = "student" in current.role_codes and not (
        {"school_admin", "coordinator", "teacher"} & current.role_codes
    )
    return learning_repo.list_assignments_for_course(
        db, current.school_id, course_id, published_only=published_only
    )


def _student_profile_for_caller(db: Session, current: CurrentMembership, user_id: uuid.UUID):
    profile = identity_repo.get_student_profile_by_user(db, current.school_id, user_id)
    if profile is None:
        raise ConflictError("El usuario actual no tiene un perfil de alumno en este colegio.")
    return profile


def upsert_my_submission(
    db: Session,
    current: CurrentMembership,
    user_id: uuid.UUID,
    assignment_id: uuid.UUID,
    body: str,
    expected_version: int,
) -> Submission:
    assignment = learning_repo.get_assignment(db, current.school_id, assignment_id)
    if assignment is None or assignment.status != "published":
        raise NotFoundError("La tarea indicada no existe o no está publicada.")
    course = _require_course(db, current, assignment.course_id)
    academics_service.require_course_access(db, current, user_id, course)
    profile = _student_profile_for_caller(db, current, user_id)
    if not academics_repo.is_student_enrolled_in_course(db, course.id, profile.id):
        raise NotFoundError("No estás matriculado en el curso de esta tarea.")

    submission = learning_repo.get_submission(db, current.school_id, assignment_id, profile.id)
    if submission is None:
        if expected_version != 0:
            raise ConflictError("La entrega cambió; actualiza e intenta nuevamente.")
        submission = Submission(
            school_id=current.school_id,
            assignment_id=assignment_id,
            student_id=profile.id,
            status="draft",
            version=0,
        )
        db.add(submission)
        db.flush()
    elif submission.version != expected_version:
        raise ConflictError(
            "La entrega cambió; actualiza e intenta nuevamente.",
        )
    elif submission.status != "draft":
        raise ConflictError("La entrega ya fue enviada; no se puede editar un borrador.")

    revision_number = learning_repo.next_revision_number(db, submission.id)
    revision = SubmissionRevision(
        submission_id=submission.id, revision_number=revision_number, body=body
    )
    db.add(revision)
    db.flush()

    submission.current_revision_id = revision.id
    submission.version += 1
    db.commit()
    db.refresh(submission)
    return submission


def get_my_submission(
    db: Session, current: CurrentMembership, user_id: uuid.UUID, assignment_id: uuid.UUID
) -> Submission | None:
    assignment = learning_repo.get_assignment(db, current.school_id, assignment_id)
    if assignment is None:
        raise NotFoundError("La tarea indicada no existe en este colegio.")
    course = _require_course(db, current, assignment.course_id)
    academics_service.require_course_access(db, current, user_id, course)
    profile = _student_profile_for_caller(db, current, user_id)
    return learning_repo.get_submission(db, current.school_id, assignment_id, profile.id)


def submit_submission(
    db: Session,
    current: CurrentMembership,
    user_id: uuid.UUID,
    assignment_id: uuid.UUID,
    body: str | None,
    expected_version: int,
) -> Submission:
    assignment = learning_repo.get_assignment(db, current.school_id, assignment_id)
    if assignment is None or assignment.status != "published":
        raise NotFoundError("La tarea indicada no existe o no está publicada.")
    course = _require_course(db, current, assignment.course_id)
    academics_service.require_course_access(db, current, user_id, course)
    profile = _student_profile_for_caller(db, current, user_id)

    submission = learning_repo.get_submission(db, current.school_id, assignment_id, profile.id)
    if submission is None:
        if expected_version != 0:
            raise ConflictError("La entrega cambió; actualiza e intenta nuevamente.")
        submission = Submission(
            school_id=current.school_id,
            assignment_id=assignment_id,
            student_id=profile.id,
            status="draft",
            version=0,
        )
        db.add(submission)
        db.flush()
    elif submission.status == "submitted":
        # Retry de submit devuelve el resultado existente (sección 9, idempotencia).
        return submission
    elif submission.version != expected_version:
        raise ConflictError("La entrega cambió; actualiza e intenta nuevamente.")

    now = datetime.now(UTC)
    if now > assignment.due_at and not assignment.allow_late:
        raise ConflictError("El plazo de entrega venció y esta tarea no admite tardías.")

    if body is not None:
        revision_number = learning_repo.next_revision_number(db, submission.id)
        revision = SubmissionRevision(
            submission_id=submission.id, revision_number=revision_number, body=body
        )
        db.add(revision)
        db.flush()
        submission.current_revision_id = revision.id

    submission.status = "submitted"
    submission.submitted_at = now
    submission.version += 1
    db.commit()
    db.refresh(submission)
    return submission


def is_late(assignment: Assignment, submission: Submission) -> bool:
    return bool(submission.submitted_at and submission.submitted_at > assignment.due_at)


def list_submissions_for_teacher(
    db: Session, current: CurrentMembership, user_id: uuid.UUID, assignment_id: uuid.UUID
) -> list[Submission]:
    assignment = learning_repo.get_assignment(db, current.school_id, assignment_id)
    if assignment is None:
        raise NotFoundError("La tarea indicada no existe en este colegio.")
    course = _require_course(db, current, assignment.course_id)
    academics_service.require_course_access(db, current, user_id, course)
    return learning_repo.list_submissions_for_assignment(db, current.school_id, assignment_id)


def list_submissions_for_student(
    db: Session, current: CurrentMembership, user_id: uuid.UUID, student_id: uuid.UUID
) -> list[Submission]:
    """Consulta por padre/tutor autorizado, docente vinculado o el propio alumno
    (sección 1: entrega vertical de la primera fase)."""
    academics_service.require_student_access(db, current, user_id, student_id)
    return learning_repo.list_submissions_for_student(db, current.school_id, student_id)
