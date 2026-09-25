from __future__ import annotations

import re
import unicodedata
import uuid
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.core.errors import NotFoundError
from app.modules.public_site import repository as public_site_repo
from app.modules.public_site.models import NewsPost
from app.modules.public_site.schemas import NewsPostCreate, NewsPostUpdate

_SLUG_INVALID_CHARS = re.compile(r"[^a-z0-9]+")


def slugify(value: str) -> str:
    # Contenido en español (sección 17/ASSUMPTIONS): normaliza tildes/eñes a ASCII
    # (NFKD + descarte de marcas combinantes) antes de filtrar caracteres válidos,
    # o "está"/"año" degradarían a fragmentos truncados en vez de "esta"/"ano".
    ascii_value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    slug = _SLUG_INVALID_CHARS.sub("-", ascii_value.strip().lower()).strip("-")
    return slug or "noticia"


def _unique_slug(db: Session, base_slug: str, *, ignore_id: uuid.UUID | None = None) -> str:
    slug = base_slug
    suffix = 2
    while True:
        existing = public_site_repo.get_by_slug(db, slug)
        if existing is None or existing.id == ignore_id:
            return slug
        slug = f"{base_slug}-{suffix}"
        suffix += 1


def create_news(db: Session, author_user_id: uuid.UUID, payload: NewsPostCreate) -> NewsPost:
    base_slug = slugify(payload.slug or payload.title)
    news = NewsPost(
        title=payload.title,
        slug=_unique_slug(db, base_slug),
        excerpt=payload.excerpt,
        body=payload.body,
        cover_image_url=payload.cover_image_url,
        status=payload.status,
        published_at=datetime.now(UTC) if payload.status == "published" else None,
        author_user_id=author_user_id,
    )
    db.add(news)
    db.flush()
    return news


def update_news(db: Session, news_id: uuid.UUID, payload: NewsPostUpdate) -> NewsPost:
    news = public_site_repo.get_news(db, news_id)
    if news is None:
        raise NotFoundError("La noticia indicada no existe.")

    data = payload.model_dump(exclude_unset=True)

    if "slug" in data or "title" in data:
        base_slug = slugify(data.get("slug") or data.get("title") or news.slug)
        news.slug = _unique_slug(db, base_slug, ignore_id=news.id)
        data.pop("slug", None)

    was_published = news.status == "published"
    for field, value in data.items():
        setattr(news, field, value)

    if news.status == "published" and not was_published:
        news.published_at = datetime.now(UTC)
    elif news.status == "draft":
        news.published_at = None

    db.flush()
    return news


def delete_news(db: Session, news_id: uuid.UUID) -> None:
    news = public_site_repo.get_news(db, news_id)
    if news is None:
        raise NotFoundError("La noticia indicada no existe.")
    db.delete(news)
    db.flush()


def require_news(db: Session, news_id: uuid.UUID) -> NewsPost:
    news = public_site_repo.get_news(db, news_id)
    if news is None:
        raise NotFoundError("La noticia indicada no existe.")
    return news
