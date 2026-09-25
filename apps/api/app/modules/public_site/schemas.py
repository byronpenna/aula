from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict

NewsStatus = Literal["draft", "published"]


class NewsPostCreate(BaseModel):
    title: str
    slug: str | None = None
    excerpt: str | None = None
    body: str
    cover_image_url: str | None = None
    status: NewsStatus = "draft"


class NewsPostUpdate(BaseModel):
    title: str | None = None
    slug: str | None = None
    excerpt: str | None = None
    body: str | None = None
    cover_image_url: str | None = None
    status: NewsStatus | None = None


class NewsPostOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    slug: str
    excerpt: str | None
    body: str
    cover_image_url: str | None
    status: NewsStatus
    published_at: datetime | None
    author_user_id: uuid.UUID
    created_at: datetime
    updated_at: datetime
