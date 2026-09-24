"""Reglas de negocio de archivos adjuntos (sección 5/9).

Regla universal (sección 6): toda operación revalida colegio + permiso + vínculo con
el recurso padre (tarea o entrega) reutilizando `academics.service`, igual que hace
`learning.service` con las entregas mismas — nunca se confía solo en que exista el
archivo.
"""

from __future__ import annotations

import base64
import uuid
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.deps import CurrentMembership
from app.core.errors import ForbiddenError, NotFoundError, UnprocessableError
from app.modules.academics import repository as academics_repo
from app.modules.academics import service as academics_service
from app.modules.files import repository as files_repo
from app.modules.files.models import File
from app.modules.files.storage import get_storage
from app.modules.identity import repository as identity_repo
from app.modules.learning import repository as learning_repo
from app.modules.learning.models import Submission

# Tipos y tamaño permitidos (sección 5): validación real de tipo/tamaño, aunque el
# "escaneo antimalware" siga siendo el adaptador ficticio documentado en
# docs/IMPLEMENTATION_STATUS.md. 5MB porque en cloud el archivo viaja en el cuerpo
# de la invocación síncrona de Lambda (límite real ~6MB); subir presignado directo
# a S3 sin pasar por Lambda queda para cuando el volumen lo justifique.
ALLOWED_CONTENT_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/webp",
    "text/plain",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}
MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024


def _validate_upload(filename: str, content_type: str, content: bytes) -> None:
    if not filename:
        raise UnprocessableError("El archivo debe tener un nombre.")
    if content_type not in ALLOWED_CONTENT_TYPES:
        raise UnprocessableError(
            f"Tipo de archivo no permitido: {content_type}.",
            details={"allowed": sorted(ALLOWED_CONTENT_TYPES)},
        )
    if len(content) == 0:
        raise UnprocessableError("El archivo está vacío.")
    if len(content) > MAX_FILE_SIZE_BYTES:
        raise UnprocessableError(
            f"El archivo supera el máximo permitido ({MAX_FILE_SIZE_BYTES // (1024 * 1024)}MB)."
        )


def _store(
    db: Session,
    settings: Settings,
    *,
    school_id: uuid.UUID,
    owner_user_id: uuid.UUID,
    attached_to_type: str,
    attached_to_id: uuid.UUID,
    filename: str,
    content_type: str,
    content: bytes,
) -> File:
    _validate_upload(filename, content_type, content)
    storage_key = (
        f"{school_id}/{attached_to_type}/{attached_to_id}/"
        f"{datetime.now(UTC).strftime('%Y%m%dT%H%M%S%f')}_{filename}"
    )
    get_storage(settings).save(storage_key, content)

    file = File(
        school_id=school_id,
        owner_user_id=owner_user_id,
        attached_to_type=attached_to_type,
        attached_to_id=attached_to_id,
        filename=filename,
        content_type=content_type,
        size_bytes=len(content),
        storage_key=storage_key,
        status="available",
    )
    db.add(file)
    db.commit()
    db.refresh(file)
    return file


def _require_assignment_and_course_access(
    db: Session, current: CurrentMembership, user_id: uuid.UUID, assignment_id: uuid.UUID
):
    assignment = learning_repo.get_assignment(db, current.school_id, assignment_id)
    if assignment is None:
        raise NotFoundError("La tarea indicada no existe en este colegio.")
    course = academics_repo.get_course(db, current.school_id, assignment.course_id)
    if course is None:
        raise NotFoundError("El curso de la tarea no existe en este colegio.")
    academics_service.require_course_access(db, current, user_id, course)
    return assignment


def upload_assignment_file(
    db: Session,
    settings: Settings,
    current: CurrentMembership,
    user_id: uuid.UUID,
    assignment_id: uuid.UUID,
    filename: str,
    content_type: str,
    content: bytes,
) -> File:
    """Material de la tarea (guías, instrucciones adjuntas): solo quien la
    administra puede subirlo, no cualquiera con acceso de lectura al curso."""
    _require_assignment_and_course_access(db, current, user_id, assignment_id)
    if not ({"school_admin", "coordinator", "teacher"} & current.role_codes):
        raise ForbiddenError("No puedes adjuntar material a esta tarea.")
    return _store(
        db,
        settings,
        school_id=current.school_id,
        owner_user_id=user_id,
        attached_to_type="assignment",
        attached_to_id=assignment_id,
        filename=filename,
        content_type=content_type,
        content=content,
    )


def list_assignment_files(
    db: Session, current: CurrentMembership, user_id: uuid.UUID, assignment_id: uuid.UUID
) -> list[File]:
    _require_assignment_and_course_access(db, current, user_id, assignment_id)
    return files_repo.list_files(db, current.school_id, "assignment", assignment_id)


def upload_my_submission_file(
    db: Session,
    settings: Settings,
    current: CurrentMembership,
    user_id: uuid.UUID,
    assignment_id: uuid.UUID,
    filename: str,
    content_type: str,
    content: bytes,
) -> File:
    """Adjunto de la propia entrega (sección 9): mismas reglas que editar el
    borrador — la tarea debe estar publicada, el alumno matriculado en el curso, y
    la entrega todavía no enviada."""
    assignment = learning_repo.get_assignment(db, current.school_id, assignment_id)
    if assignment is None or assignment.status != "published":
        raise NotFoundError("La tarea indicada no existe o no está publicada.")
    course = academics_repo.get_course(db, current.school_id, assignment.course_id)
    if course is None:
        raise NotFoundError("El curso de la tarea no existe en este colegio.")
    academics_service.require_course_access(db, current, user_id, course)

    profile = identity_repo.get_student_profile_by_user(db, current.school_id, user_id)
    if profile is None:
        raise ForbiddenError("El usuario actual no tiene un perfil de alumno en este colegio.")
    if not academics_repo.is_student_enrolled_in_course(db, course.id, profile.id):
        raise NotFoundError("No estás matriculado en el curso de esta tarea.")

    submission = learning_repo.get_submission(db, current.school_id, assignment_id, profile.id)
    if submission is not None and submission.status == "submitted":
        raise ForbiddenError("La entrega ya fue enviada; no se pueden agregar más archivos.")
    if submission is None:
        submission = Submission(
            school_id=current.school_id,
            assignment_id=assignment_id,
            student_id=profile.id,
            status="draft",
            version=0,
        )
        db.add(submission)
        db.flush()

    return _store(
        db,
        settings,
        school_id=current.school_id,
        owner_user_id=user_id,
        attached_to_type="submission",
        attached_to_id=submission.id,
        filename=filename,
        content_type=content_type,
        content=content,
    )


def list_submission_files(
    db: Session, current: CurrentMembership, user_id: uuid.UUID, submission_id: uuid.UUID
) -> list[File]:
    submission = learning_repo.get_submission_by_id(db, current.school_id, submission_id)
    if submission is None:
        raise NotFoundError("La entrega indicada no existe en este colegio.")
    academics_service.require_student_access(db, current, user_id, submission.student_id)
    return files_repo.list_files(db, current.school_id, "submission", submission_id)


def get_download(
    db: Session,
    settings: Settings,
    current: CurrentMembership,
    user_id: uuid.UUID,
    file_id: uuid.UUID,
) -> tuple[File, str | None, bytes | None]:
    """Revalida acceso según el tipo de padre antes de entregar contenido/URL
    (nunca basta con conocer el `file_id`, sección 6, [S1])."""
    file = files_repo.get_file(db, current.school_id, file_id)
    if file is None:
        raise NotFoundError("El archivo indicado no existe en este colegio.")

    if file.attached_to_type == "assignment":
        _require_assignment_and_course_access(db, current, user_id, file.attached_to_id)
    elif file.attached_to_type == "submission":
        submission = learning_repo.get_submission_by_id(db, current.school_id, file.attached_to_id)
        if submission is None:
            raise NotFoundError("La entrega asociada ya no existe.")
        academics_service.require_student_access(db, current, user_id, submission.student_id)
    else:  # pragma: no cover - no debería ocurrir, tipos cerrados a los dos de arriba
        raise NotFoundError("El archivo indicado no existe en este colegio.")

    storage = get_storage(settings)
    url = storage.download_url(file.storage_key)
    if url is not None:
        return file, url, None
    return file, None, storage.read(file.storage_key)


def encode_content(content: bytes) -> str:
    return base64.b64encode(content).decode("ascii")
