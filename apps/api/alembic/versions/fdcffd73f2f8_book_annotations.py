"""book annotations

Revision ID: fdcffd73f2f8
Revises: 85415ab15c25
Create Date: 2026-10-29 16:24:03.857704

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'fdcffd73f2f8'
down_revision: Union[str, None] = '85415ab15c25'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# No se toca `content.news_posts` aquí: es el drift preexistente documentado
# (ver c47a9e21f6b3_books_and_purchases.py y 85415ab15c25_book_file_versions.py).


def upgrade() -> None:
    op.create_table(
        'book_annotations',
        sa.Column('book_id', sa.UUID(), nullable=False),
        sa.Column('author_user_id', sa.UUID(), nullable=False),
        sa.Column('kind', sa.String(), nullable=False),
        sa.Column('color', sa.String(), nullable=True),
        sa.Column('body', sa.String(), nullable=True),
        sa.Column('is_shared', sa.Boolean(), nullable=False),
        sa.Column('page_number', sa.Integer(), nullable=True),
        sa.Column('x', sa.Float(), nullable=True),
        sa.Column('y', sa.Float(), nullable=True),
        sa.Column('rects', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column('cfi_range', sa.String(), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('school_id', sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(['author_user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['book_id'], ['books.id'], ),
        sa.ForeignKeyConstraint(['school_id'], ['schools.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_book_annotations_book_id'), 'book_annotations', ['book_id'], unique=False)
    op.create_index(op.f('ix_book_annotations_school_id'), 'book_annotations', ['school_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_book_annotations_school_id'), table_name='book_annotations')
    op.drop_index(op.f('ix_book_annotations_book_id'), table_name='book_annotations')
    op.drop_table('book_annotations')
