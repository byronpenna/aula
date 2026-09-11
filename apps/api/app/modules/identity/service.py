from __future__ import annotations

import uuid
from datetime import UTC, datetime

from passlib.context import CryptContext
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import UnauthorizedError
from app.core.security import issue_local_token
from app.modules.identity import repository as identity_repo
from app.modules.identity.models import AuditEvent, User

_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(raw_password: str) -> str:
    return _pwd_context.hash(raw_password)


def local_login(db: Session, settings: Settings, username: str, password: str) -> str:
    """Adaptador de login local (sección 17): valida usuario/contraseña reales
    contra `local_auth_credentials`, no un bypass de header libre de rol."""
    if not settings.local_auth_enabled:
        raise UnauthorizedError("El login local está deshabilitado en este ambiente.")

    credential = identity_repo.get_local_credential(db, username)
    if credential is None or not _pwd_context.verify(password, credential.password_hash):
        raise UnauthorizedError("Usuario o contraseña incorrectos.")

    user = db.get(User, credential.user_id)
    if user is None or user.status != "active":
        raise UnauthorizedError("El usuario no existe o está inactivo.")

    return issue_local_token(settings, cognito_sub=user.cognito_sub or str(user.id))


def record_audit_event(
    db: Session,
    *,
    school_id: uuid.UUID | None,
    actor_id: uuid.UUID | None,
    action: str,
    target_type: str,
    target_id: str,
    changes: dict | None = None,
    request_id: str | None = None,
) -> None:
    """Inserta un evento de auditoría en la misma transacción que el cambio de
    negocio (no hace commit por su cuenta: el llamador controla la transacción)."""
    db.add(
        AuditEvent(
            school_id=school_id,
            actor_id=actor_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            changes=changes or {},
            request_id=request_id,
            occurred_at=datetime.now(UTC),
        )
    )


def list_linked_students(db: Session, guardian_user_id: uuid.UUID) -> list[dict]:
    links = identity_repo.get_active_guardian_links(db, guardian_user_id)
    results = []
    for link in links:
        profile = identity_repo.get_student_profile(db, link.student_id)
        if profile is None:
            continue
        student_user = db.get(User, profile.user_id) if profile.user_id else None
        results.append(
            {
                "student_id": profile.id,
                "school_id": profile.school_id,
                "student_number": profile.student_number,
                "display_name": student_user.display_name if student_user else None,
                "relationship_label": link.relationship_label,
            }
        )
    return results
