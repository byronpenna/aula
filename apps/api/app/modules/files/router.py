from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, UploadFile
from fastapi import File as FastAPIFile
from sqlalchemy.orm import Session

from app.core.config import Settings, get_settings
from app.core.deps import CurrentMembership, get_current_membership, get_current_user
from app.db.session import get_db
from app.modules.files import service as files_service
from app.modules.files.schemas import FileDownloadOut, FileOut
from app.modules.identity.models import User

router = APIRouter(tags=["files"])


@router.post("/assignments/{assignment_id}/files", response_model=FileOut)
async def upload_assignment_file(
    assignment_id: uuid.UUID,
    upload: UploadFile = FastAPIFile(...),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    user: User = Depends(get_current_user),
    current: CurrentMembership = Depends(get_current_membership),
):
    content = await upload.read()
    return files_service.upload_assignment_file(
        db,
        settings,
        current,
        user.id,
        assignment_id,
        upload.filename or "archivo",
        upload.content_type or "application/octet-stream",
        content,
    )


@router.get("/assignments/{assignment_id}/files", response_model=list[FileOut])
def list_assignment_files(
    assignment_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    current: CurrentMembership = Depends(get_current_membership),
):
    return files_service.list_assignment_files(db, current, user.id, assignment_id)


@router.post("/assignments/{assignment_id}/my-submission/files", response_model=FileOut)
async def upload_my_submission_file(
    assignment_id: uuid.UUID,
    upload: UploadFile = FastAPIFile(...),
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    user: User = Depends(get_current_user),
    current: CurrentMembership = Depends(get_current_membership),
):
    content = await upload.read()
    return files_service.upload_my_submission_file(
        db,
        settings,
        current,
        user.id,
        assignment_id,
        upload.filename or "archivo",
        upload.content_type or "application/octet-stream",
        content,
    )


@router.get("/submissions/{submission_id}/files", response_model=list[FileOut])
def list_submission_files(
    submission_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    current: CurrentMembership = Depends(get_current_membership),
):
    return files_service.list_submission_files(db, current, user.id, submission_id)


@router.get("/files/{file_id}/download", response_model=FileDownloadOut)
def download_file(
    file_id: uuid.UUID,
    db: Session = Depends(get_db),
    settings: Settings = Depends(get_settings),
    user: User = Depends(get_current_user),
    current: CurrentMembership = Depends(get_current_membership),
):
    file, url, content = files_service.get_download(db, settings, current, user.id, file_id)
    return FileDownloadOut(
        url=url,
        content_base64=files_service.encode_content(content) if content is not None else None,
        filename=file.filename,
        content_type=file.content_type,
    )
