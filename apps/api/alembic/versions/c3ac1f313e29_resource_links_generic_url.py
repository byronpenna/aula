"""resource_links_generic_url

Revision ID: c3ac1f313e29
Revises: f4d329dd94e6
Create Date: 2026-11-10 20:26:10.067522

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c3ac1f313e29'
down_revision: Union[str, None] = 'f4d329dd94e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Nota: el autogenerate también detectó 'content.news_posts' como "faltante"
    # (mismo falso positivo documentado en f6a2a11e9ce7_resource_sections.py) y
    # trató 'youtube_url' -> 'url' como un add+drop en vez de un rename — se
    # ajusta a mano para no perder las URLs ya guardadas por quienes ya
    # probaron la feature de videos.
    op.alter_column('resource_links', 'youtube_url', new_column_name='url')
    op.drop_column('resource_links', 'youtube_video_id')


def downgrade() -> None:
    op.add_column('resource_links', sa.Column('youtube_video_id', sa.VARCHAR(), autoincrement=False, nullable=False, server_default=''))
    op.alter_column('resource_links', 'url', new_column_name='youtube_url')
