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
from app.core.permissions import ENROLLMENT_MANAGE
from app.modules.academics import repository as academics_repo
from app.modules.academics import service as academics_service
from app.modules.academics.models import Course
from app.modules.files import repository as files_repo
from app.modules.files.models import File, FileNote
from app.modules.files.schemas import FileNoteCreate
from app.modules.files.storage import get_storage
from app.modules.identity import repository as identity_repo
from app.modules.identity import service as identity_service
from app.modules.learning import repository as learning_repo
from app.modules.learning.models import Submission

# Fotografía del alumno (gestión de alumnos, Administración): solo tipos de imagen,
# a diferencia de `ALLOWED_CONTENT_TYPES` (que admite PDF/Word para adjuntos).
STUDENT_PHOTO_CONTENT_TYPES = {"image/png", "image/jpeg", "image/webp"}

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
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
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


def upload_resource_file(
    db: Session,
    settings: Settings,
    current: CurrentMembership,
    user_id: uuid.UUID,
    section_id: uuid.UUID,
    filename: str,
    content_type: str,
    content: bytes,
) -> File:
    """Recursos del curso (sección nueva, no del documento base): cualquier tipo del
    catálogo general (`ALLOWED_CONTENT_TYPES` — PDF, Word, Excel, PowerPoint,
    imágenes, texto), validado por `_store`/`_validate_upload`; solo quien
    administra el curso puede subirlos — igual criterio que el material de tarea
    (ver upload_assignment_file), pero course-scoped vía
    academics_service.require_course_staff_access en vez de un chequeo de rol
    suelto."""
    section = learning_repo.get_resource_section(db, current.school_id, section_id)
    if section is None:
        raise NotFoundError("La sección de recursos indicada no existe en este colegio.")
    course = academics_repo.get_course(db, current.school_id, section.course_id)
    if course is None:
        raise NotFoundError("El curso de la sección no existe en este colegio.")
    academics_service.require_course_staff_access(db, current, user_id, course)

    return _store(
        db,
        settings,
        school_id=current.school_id,
        owner_user_id=user_id,
        attached_to_type="resource_section",
        attached_to_id=section_id,
        filename=filename,
        content_type=content_type,
        content=content,
    )


def upload_course_post_image(
    db: Session,
    settings: Settings,
    current: CurrentMembership,
    user_id: uuid.UUID,
    post_id: uuid.UUID,
    filename: str,
    content_type: str,
    content: bytes,
) -> File:
    """Imagen de una publicación del curso (sección nueva, tipo "red social"):
    solo imágenes (mismo conjunto que upload_student_photo), y solo quien
    administra el curso puntual puede agregarlas — igual criterio que crear la
    publicación misma (ASSIGNMENT_MANAGE + require_course_access, ver
    learning/service.py::create_course_post)."""
    post = learning_repo.get_course_post(db, current.school_id, post_id)
    if post is None:
        raise NotFoundError("La publicación indicada no existe en este colegio.")
    course = academics_repo.get_course(db, current.school_id, post.course_id)
    if course is None:
        raise NotFoundError("El curso de la publicación no existe en este colegio.")
    academics_service.require_course_access(db, current, user_id, course)

    if content_type not in STUDENT_PHOTO_CONTENT_TYPES:
        raise UnprocessableError(
            f"Tipo de archivo no permitido: {content_type}.",
            details={"allowed": sorted(STUDENT_PHOTO_CONTENT_TYPES)},
        )
    return _store(
        db,
        settings,
        school_id=current.school_id,
        owner_user_id=user_id,
        attached_to_type="course_post",
        attached_to_id=post_id,
        filename=filename,
        content_type=content_type,
        content=content,
    )


def upload_student_photo(
    db: Session,
    settings: Settings,
    current: CurrentMembership,
    student_id: uuid.UUID,
    filename: str,
    content_type: str,
    content: bytes,
) -> File:
    """Gestión de alumnos (Administración > Alumnos): solo quien administra
    matrícula (`ENROLLMENT_MANAGE`, mismo permiso que crear/editar el perfil)
    puede subir o reemplazar la fotografía."""
    if ENROLLMENT_MANAGE not in current.permission_codes:
        raise ForbiddenError("No puedes administrar la fotografía de este alumno.")
    profile = identity_repo.get_student_profile(db, student_id)
    if profile is None or profile.school_id != current.school_id:
        raise NotFoundError("El alumno indicado no existe en este colegio.")
    if content_type not in STUDENT_PHOTO_CONTENT_TYPES:
        raise UnprocessableError(
            "La fotografía debe ser una imagen (PNG, JPEG o WEBP).",
            details={"allowed": sorted(STUDENT_PHOTO_CONTENT_TYPES)},
        )
    file = _store(
        db,
        settings,
        school_id=current.school_id,
        owner_user_id=current.membership.user_id,
        attached_to_type="student_profile",
        attached_to_id=student_id,
        filename=filename,
        content_type=content_type,
        content=content,
    )
    profile.photo_file_id = file.id
    db.commit()
    return file


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
    elif file.attached_to_type == "resource_section":
        # Una sección eliminada (baja lógica) sigue resolviéndose aquí a propósito
        # (sección 6): el PDF no deja de ser descargable solo porque su sección se
        # "eliminó" — ver learning_service.delete_resource_section.
        section = learning_repo.get_resource_section(db, current.school_id, file.attached_to_id)
        if section is None:
            raise NotFoundError("La sección asociada ya no existe.")
        course = academics_repo.get_course(db, current.school_id, section.course_id)
        if course is None:
            raise NotFoundError("El curso de la sección no existe en este colegio.")
        academics_service.require_course_access(db, current, user_id, course)
    elif file.attached_to_type == "student_profile":
        # Solo administración/coordinación por ahora (ver `upload_student_photo`);
        # no se expone todavía al alumno ni a su tutor.
        if ENROLLMENT_MANAGE not in current.permission_codes:
            raise ForbiddenError("No puedes ver esta fotografía.")
    elif file.attached_to_type == "course_post":
        # Cualquiera con acceso al curso ve la imagen de la publicación — es
        # contenido pensado para toda la clase, no solo para quien administra.
        post = learning_repo.get_course_post(db, current.school_id, file.attached_to_id)
        if post is None:
            raise NotFoundError("La publicación asociada ya no existe.")
        course = academics_repo.get_course(db, current.school_id, post.course_id)
        if course is None:
            raise NotFoundError("El curso de la publicación no existe en este colegio.")
        academics_service.require_course_access(db, current, user_id, course)
    else:  # pragma: no cover - no debería ocurrir, tipos cerrados a los de arriba
        raise NotFoundError("El archivo indicado no existe en este colegio.")

    storage = get_storage(settings)
    url = storage.download_url(file.storage_key)
    if url is not None:
        return file, url, None
    return file, None, storage.read(file.storage_key)


def encode_content(content: bytes) -> str:
    return base64.b64encode(content).decode("ascii")


# --- Notas sobre PDFs de recursos del curso ---------------------------------
#
# Solo soportadas hoy sobre `attached_to_type == "resource_section"` (ver
# FileNote en models.py); ver el PDF alcanza con require_course_access, crear o
# borrar una nota exige require_course_staff_access, igual criterio que el resto
# de recursos del curso (learning/service.py).


def _require_resource_file_course(db: Session, current: CurrentMembership, file: File) -> Course:
    if file.attached_to_type != "resource_section":
        raise NotFoundError("El archivo indicado no admite notas.")
    section = learning_repo.get_resource_section(db, current.school_id, file.attached_to_id)
    if section is None:
        raise NotFoundError("La sección asociada ya no existe.")
    course = academics_repo.get_course(db, current.school_id, section.course_id)
    if course is None:
        raise NotFoundError("El curso de la sección no existe en este colegio.")
    return course


def _with_author_names(db: Session, notes: list[FileNote]) -> list[FileNote]:
    names: dict[uuid.UUID, str] = {}
    for note in notes:
        if note.author_user_id not in names:
            author = identity_repo.get_user(db, note.author_user_id)
            names[note.author_user_id] = author.display_name if author else "Usuario eliminado"
        note.author_name = names[note.author_user_id]  # type: ignore[attr-defined]
    return notes


def list_file_notes(
    db: Session, current: CurrentMembership, user_id: uuid.UUID, file_id: uuid.UUID
) -> list[FileNote]:
    file = files_repo.get_file(db, current.school_id, file_id)
    if file is None:
        raise NotFoundError("El archivo indicado no existe en este colegio.")
    course = _require_resource_file_course(db, current, file)
    academics_service.require_course_access(db, current, user_id, course)
    notes = files_repo.list_notes(db, current.school_id, file_id)
    return _with_author_names(db, notes)


def create_file_note(
    db: Session,
    current: CurrentMembership,
    user_id: uuid.UUID,
    file_id: uuid.UUID,
    payload: FileNoteCreate,
    request_id: str | None,
) -> FileNote:
    file = files_repo.get_file(db, current.school_id, file_id)
    if file is None:
        raise NotFoundError("El archivo indicado no existe en este colegio.")
    course = _require_resource_file_course(db, current, file)
    academics_service.require_course_staff_access(db, current, user_id, course)

    if payload.page_number < 1:
        raise UnprocessableError("page_number debe ser mayor o igual a 1.")
    body = payload.body.strip()
    if not body:
        raise UnprocessableError("La nota no puede estar vacía.")
    if (payload.x is None) != (payload.y is None):
        raise UnprocessableError("x e y deben enviarse juntos, o ninguno de los dos.")
    if payload.x is not None and not (
        0 <= payload.x <= 1 and 0 <= (payload.y or 0) <= 1
    ):
        raise UnprocessableError("x e y deben ser fracciones entre 0 y 1.")

    note = FileNote(
        school_id=current.school_id,
        file_id=file_id,
        author_user_id=user_id,
        page_number=payload.page_number,
        x=payload.x,
        y=payload.y,
        body=body,
    )
    db.add(note)
    identity_service.record_audit_event(
        db,
        school_id=current.school_id,
        actor_id=current.membership.user_id,
        action="file_note.create",
        target_type="file_note",
        target_id=str(note.id),
        request_id=request_id,
    )
    db.commit()
    db.refresh(note)
    [note] = _with_author_names(db, [note])
    return note


def delete_file_note(
    db: Session,
    current: CurrentMembership,
    user_id: uuid.UUID,
    note_id: uuid.UUID,
    request_id: str | None,
) -> None:
    note = files_repo.get_note(db, current.school_id, note_id)
    if note is None:
        raise NotFoundError("La nota indicada no existe en este colegio.")
    file = files_repo.get_file(db, current.school_id, note.file_id)
    if file is None:
        raise NotFoundError("El archivo indicado no existe en este colegio.")
    course = _require_resource_file_course(db, current, file)
    academics_service.require_course_staff_access(db, current, user_id, course)

    db.delete(note)
    identity_service.record_audit_event(
        db,
        school_id=current.school_id,
        actor_id=current.membership.user_id,
        action="file_note.delete",
        target_type="file_note",
        target_id=str(note.id),
        request_id=request_id,
    )
    db.commit()
