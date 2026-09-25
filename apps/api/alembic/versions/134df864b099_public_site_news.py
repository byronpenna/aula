"""public_site news

Revision ID: 134df864b099
Revises: 8349f166b6e5
Create Date: 2026-09-23 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '134df864b099'
down_revision: Union[str, None] = '8349f166b6e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Schema separado del `public` de aula virtual (sección 7 / apps/public_site):
    # mismo Postgres, límite de dominio por schema en vez de otra base o servidor.
    op.execute("CREATE SCHEMA IF NOT EXISTS content")
    op.create_table(
        'news_posts',
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('slug', sa.String(), nullable=False),
        sa.Column('excerpt', sa.String(), nullable=True),
        sa.Column('body', sa.String(), nullable=False),
        sa.Column('cover_image_url', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('author_user_id', sa.UUID(), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['author_user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('slug'),
        schema='content',
    )


def downgrade() -> None:
    op.drop_table('news_posts', schema='content')
    op.execute("DROP SCHEMA IF EXISTS content")
