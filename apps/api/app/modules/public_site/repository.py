from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.public_site.models import NewsPost


def list_news(db: Session) -> list[NewsPost]:
    stmt = select(NewsPost).order_by(NewsPost.created_at.desc())
    return list(db.execute(stmt).scalars().all())


def list_published_news(db: Session) -> list[NewsPost]:
    stmt = (
        select(NewsPost)
        .where(NewsPost.status == "published")
        .order_by(NewsPost.published_at.desc())
    )
    return list(db.execute(stmt).scalars().all())


def get_news(db: Session, news_id: uuid.UUID) -> NewsPost | None:
    return db.get(NewsPost, news_id)


def get_by_slug(db: Session, slug: str) -> NewsPost | None:
    stmt = select(NewsPost).where(NewsPost.slug == slug)
    return db.execute(stmt).scalar_one_or_none()
