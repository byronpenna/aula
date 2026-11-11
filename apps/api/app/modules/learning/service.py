"""Reglas de negocio de tareas y entregas (sección 9, "Publicar y entregar tarea").

Regla universal (sección 6): toda operación valida colegio + permiso + vínculo con el
curso/alumno antes de tocar datos, reutilizando `academics.service` para eso.
"""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from urllib.parse import urlparse

from sqlalchemy.orm import Session

from app.core.deps import CurrentMembership
from app.core.errors import ConflictError, NotFoundError, UnprocessableError
from app.modules.academics import repository as academics_repo
from app.modules.academics import service as academics_service
from app.modules.academics.models import Course
from app.modules.files import repository as files_repo
from app.modules.identity import repository as identity_repo
from app.modules.identity import service as identity_service
from app.modules.learning import repository as learning_repo
from app.modules.learning.models import (
    Assignment,
    ResourceLink,
    ResourceLinkComment,
    ResourceSection,
    Submission,
    SubmissionRevision,
)
from app.modules.learning.schemas import (
    AssignmentCreate,
    AssignmentUpdate,
    ResourceLinkCommentCreate,
    ResourceLinkCreate,
)


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


# --- Recursos del curso (secciones de PDFs) --------------------------------
#
# Ver el curso (academics_service.require_course_access) alcanza para cualquier
# rol con acceso de lectura al curso; crear/renombrar/eliminar una sección exige
# administrarlo (require_course_staff_access: admin/coordinación, o el docente
# asignado a este curso puntual — ver academics/service.py).


def _require_resource_section(
    db: Session, current: CurrentMembership, section_id: uuid.UUID
) -> tuple[ResourceSection, Course]:
    section = learning_repo.get_resource_section(db, current.school_id, section_id)
    if section is None:
        raise NotFoundError("La sección de recursos indicada no existe en este colegio.")
    course = _require_course(db, current, section.course_id)
    return section, course


def _clean_name(name: str) -> str:
    return " ".join(name.strip().split())


def create_resource_section(
    db: Session,
    current: CurrentMembership,
    user_id: uuid.UUID,
    course_id: uuid.UUID,
    name: str,
    request_id: str | None,
) -> ResourceSection:
    course = _require_course(db, current, course_id)
    academics_service.require_course_staff_access(db, current, user_id, course)
    if course.status == "archived":
        raise UnprocessableError("El curso está archivado; no admite secciones nuevas.")
    clean_name = _clean_name(name)
    if not clean_name:
        raise UnprocessableError("El nombre no puede estar vacío.")

    section = ResourceSection(school_id=current.school_id, course_id=course_id, name=clean_name)
    db.add(section)
    identity_service.record_audit_event(
        db,
        school_id=current.school_id,
        actor_id=current.membership.user_id,
        action="resource_section.create",
        target_type="resource_section",
        target_id=str(section.id),
        request_id=request_id,
    )
    db.commit()
    db.refresh(section)
    return section


def rename_resource_section(
    db: Session,
    current: CurrentMembership,
    user_id: uuid.UUID,
    section_id: uuid.UUID,
    name: str,
    request_id: str | None,
) -> ResourceSection:
    section, course = _require_resource_section(db, current, section_id)
    academics_service.require_course_staff_access(db, current, user_id, course)
    clean_name = _clean_name(name)
    if not clean_name:
        raise UnprocessableError("El nombre no puede estar vacío.")

    section.name = clean_name
    identity_service.record_audit_event(
        db,
        school_id=current.school_id,
        actor_id=current.membership.user_id,
        action="resource_section.rename",
        target_type="resource_section",
        target_id=str(section.id),
        request_id=request_id,
    )
    db.commit()
    db.refresh(section)
    return section


def delete_resource_section(
    db: Session,
    current: CurrentMembership,
    user_id: uuid.UUID,
    section_id: uuid.UUID,
    request_id: str | None,
) -> ResourceSection:
    """Baja lógica (sección 6, mismo criterio que Course.status): nunca se borra la
    fila ni sus archivos — siguen en `files`, solo se agrupan como "Sin sección" en
    vez de bajo este nombre (ver get_course_resources)."""
    section, course = _require_resource_section(db, current, section_id)
    academics_service.require_course_staff_access(db, current, user_id, course)
    if section.status != "deleted":
        section.status = "deleted"
        identity_service.record_audit_event(
            db,
            school_id=current.school_id,
            actor_id=current.membership.user_id,
            action="resource_section.delete",
            target_type="resource_section",
            target_id=str(section.id),
            request_id=request_id,
        )
        db.commit()
        db.refresh(section)
    return section


def get_course_resources(
    db: Session, current: CurrentMembership, user_id: uuid.UUID, course_id: uuid.UUID
) -> dict:
    course = _require_course(db, current, course_id)
    academics_service.require_course_access(db, current, user_id, course)

    all_sections = learning_repo.list_resource_sections(db, current.school_id, course_id)
    sections = []
    unsectioned_files = []
    unsectioned_links = []
    for section in all_sections:
        files = files_repo.list_files(db, current.school_id, "resource_section", section.id)
        links = learning_repo.list_resource_links(db, current.school_id, section.id)
        if section.status == "deleted":
            unsectioned_files.extend(files)
            unsectioned_links.extend(links)
        else:
            sections.append({
                "id": section.id,
                "name": section.name,
                "status": section.status,
                "files": files,
                "links": links,
            })

    return {
        "sections": sections,
        "unsectioned_files": unsectioned_files,
        "unsectioned_links": unsectioned_links,
    }


# --- Enlaces externos como recurso de una sección ---------------------------
#
# Mismo criterio de acceso que un archivo (sección 6): agregar/quitar un
# enlace exige administrar el curso (require_course_staff_access); verlo
# alcanza con acceso de lectura (require_course_access) — eso incluye
# comentar, a diferencia de las notas de un PDF (FileNote), que son
# exclusivas de quien administra el curso. Reconocer de qué proveedor es
# (YouTube/Facebook/TikTok/página cualquiera) para mostrar una vista previa es
# puramente de presentación y vive en el frontend (lib/linkPreview.ts); aquí
# solo se valida que sea una URL absoluta de verdad.


def _validate_url(url: str) -> str:
    clean = url.strip()
    parsed = urlparse(clean)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise UnprocessableError("Ingresa una URL completa (debe empezar con http:// o https://).")
    return clean


def _require_resource_link(
    db: Session, current: CurrentMembership, link_id: uuid.UUID
) -> tuple[ResourceLink, Course]:
    link = learning_repo.get_resource_link(db, current.school_id, link_id)
    if link is None:
        raise NotFoundError("El enlace indicado no existe en este colegio.")
    section = learning_repo.get_resource_section(db, current.school_id, link.resource_section_id)
    if section is None:
        raise NotFoundError("La sección del enlace no existe en este colegio.")
    course = _require_course(db, current, section.course_id)
    return link, course


def create_resource_link(
    db: Session,
    current: CurrentMembership,
    user_id: uuid.UUID,
    section_id: uuid.UUID,
    payload: ResourceLinkCreate,
    request_id: str | None,
) -> ResourceLink:
    section, course = _require_resource_section(db, current, section_id)
    academics_service.require_course_staff_access(db, current, user_id, course)

    title = _clean_name(payload.title)
    if not title:
        raise UnprocessableError("El título no puede estar vacío.")
    url = _validate_url(payload.url)

    link = ResourceLink(
        school_id=current.school_id,
        resource_section_id=section.id,
        title=title,
        url=url,
        created_by_user_id=user_id,
    )
    db.add(link)
    identity_service.record_audit_event(
        db,
        school_id=current.school_id,
        actor_id=current.membership.user_id,
        action="resource_link.create",
        target_type="resource_link",
        target_id=str(link.id),
        request_id=request_id,
    )
    db.commit()
    db.refresh(link)
    return link


def delete_resource_link(
    db: Session,
    current: CurrentMembership,
    user_id: uuid.UUID,
    link_id: uuid.UUID,
    request_id: str | None,
) -> None:
    link, course = _require_resource_link(db, current, link_id)
    academics_service.require_course_staff_access(db, current, user_id, course)

    learning_repo.delete_link_comments(db, link.id)
    db.flush()  # fuerza el DELETE de comment_table antes del de resource_links (FK)
    db.delete(link)
    identity_service.record_audit_event(
        db,
        school_id=current.school_id,
        actor_id=current.membership.user_id,
        action="resource_link.delete",
        target_type="resource_link",
        target_id=str(link_id),
        request_id=request_id,
    )
    db.commit()


def _with_comment_author_names(
    db: Session, comments: list[ResourceLinkComment]
) -> list[ResourceLinkComment]:
    names: dict[uuid.UUID, str] = {}
    for comment in comments:
        if comment.author_user_id not in names:
            author = identity_repo.get_user(db, comment.author_user_id)
            names[comment.author_user_id] = author.display_name if author else "Usuario eliminado"
        comment.author_name = names[comment.author_user_id]  # type: ignore[attr-defined]
    return comments


def list_link_comments(
    db: Session, current: CurrentMembership, user_id: uuid.UUID, link_id: uuid.UUID
) -> list[ResourceLinkComment]:
    link, course = _require_resource_link(db, current, link_id)
    academics_service.require_course_access(db, current, user_id, course)
    comments = learning_repo.list_link_comments(db, current.school_id, link.id)
    return _with_comment_author_names(db, comments)


def create_link_comment(
    db: Session,
    current: CurrentMembership,
    user_id: uuid.UUID,
    link_id: uuid.UUID,
    payload: ResourceLinkCommentCreate,
    request_id: str | None,
) -> ResourceLinkComment:
    """A diferencia de crear/quitar el enlace, comentar solo exige estar en el
    curso (require_course_access): alumno, tutor, docente o quien administra —
    "comentarios internos de los que están en el curso", no solo de staff."""
    link, course = _require_resource_link(db, current, link_id)
    academics_service.require_course_access(db, current, user_id, course)

    body = payload.body.strip()
    if not body:
        raise UnprocessableError("El comentario no puede estar vacío.")

    comment = ResourceLinkComment(
        school_id=current.school_id,
        resource_link_id=link.id,
        author_user_id=user_id,
        body=body,
    )
    db.add(comment)
    identity_service.record_audit_event(
        db,
        school_id=current.school_id,
        actor_id=current.membership.user_id,
        action="resource_link_comment.create",
        target_type="resource_link_comment",
        target_id=str(comment.id),
        request_id=request_id,
    )
    db.commit()
    db.refresh(comment)
    author = identity_repo.get_user(db, user_id)
    comment.author_name = author.display_name if author else "Usuario eliminado"  # type: ignore[attr-defined]
    return comment
