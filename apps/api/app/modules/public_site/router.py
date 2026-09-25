from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.deps import CurrentMembership, get_current_user, require_permission
from app.core.permissions import PUBLIC_SITE_MANAGE
from app.db.session import get_db
from app.modules.identity.models import User
from app.modules.public_site import repository as public_site_repo
from app.modules.public_site import service as public_site_service
from app.modules.public_site.models import NewsPost
from app.modules.public_site.schemas import NewsPostCreate, NewsPostOut, NewsPostUpdate

router = APIRouter(tags=["public-site"])


@router.get("/public-site/news", response_model=list[NewsPostOut])
def list_news(
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(PUBLIC_SITE_MANAGE)),
) -> list[NewsPost]:
    return public_site_repo.list_news(db)


@router.post("/public-site/news", response_model=NewsPostOut)
def create_news(
    payload: NewsPostCreate,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    current: CurrentMembership = Depends(require_permission(PUBLIC_SITE_MANAGE)),
) -> NewsPost:
    return public_site_service.create_news(db, user.id, payload)


@router.get("/public-site/news/{news_id}", response_model=NewsPostOut)
def get_news(
    news_id: uuid.UUID,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(PUBLIC_SITE_MANAGE)),
) -> NewsPost:
    return public_site_service.require_news(db, news_id)


@router.put("/public-site/news/{news_id}", response_model=NewsPostOut)
def update_news(
    news_id: uuid.UUID,
    payload: NewsPostUpdate,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(PUBLIC_SITE_MANAGE)),
) -> NewsPost:
    return public_site_service.update_news(db, news_id, payload)


@router.delete("/public-site/news/{news_id}", status_code=204, response_model=None)
def delete_news(
    news_id: uuid.UUID,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(PUBLIC_SITE_MANAGE)),
) -> None:
    public_site_service.delete_news(db, news_id)
