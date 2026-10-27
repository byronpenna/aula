"""books and purchases

Revision ID: c47a9e21f6b3
Revises: 1534feaaf3bc
Create Date: 2026-10-26 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c47a9e21f6b3'
down_revision: Union[str, None] = '1534feaaf3bc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Nota: el autogenerate también detecta 'content.news_posts' como "faltante"
    # (alembic/env.py no compara con include_schemas=True y esa tabla vive en el
    # schema no default 'content'); se omite aquí, no es parte de esta entrega —
    # mismo caso ya documentado en 5a833d0dd88c_course_name.py.
    op.create_table(
        'books',
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('author', sa.String(), nullable=True),
        sa.Column('description', sa.String(), nullable=True),
        sa.Column('price', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('file_filename', sa.String(), nullable=True),
        sa.Column('file_content_type', sa.String(), nullable=True),
        sa.Column('file_size_bytes', sa.Integer(), nullable=True),
        sa.Column('file_storage_key', sa.String(), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('school_id', sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(['school_id'], ['schools.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_books_school_id'), 'books', ['school_id'], unique=False)

    op.create_table(
        'book_purchases',
        sa.Column('book_id', sa.UUID(), nullable=False),
        sa.Column('student_id', sa.UUID(), nullable=False),
        sa.Column('method', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('amount', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('recorded_by_user_id', sa.UUID(), nullable=True),
        sa.Column('external_reference', sa.String(), nullable=True),
        sa.Column('paid_at', sa.Date(), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('school_id', sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(['book_id'], ['books.id'], ),
        sa.ForeignKeyConstraint(['recorded_by_user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['school_id'], ['schools.id'], ),
        sa.ForeignKeyConstraint(['student_id'], ['student_profiles.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('external_reference', name='uq_book_purchase_external_reference'),
    )
    op.create_index(op.f('ix_book_purchases_book_id'), 'book_purchases', ['book_id'], unique=False)
    op.create_index(op.f('ix_book_purchases_school_id'), 'book_purchases', ['school_id'], unique=False)
    op.create_index(op.f('ix_book_purchases_student_id'), 'book_purchases', ['student_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_book_purchases_student_id'), table_name='book_purchases')
    op.drop_index(op.f('ix_book_purchases_school_id'), table_name='book_purchases')
    op.drop_index(op.f('ix_book_purchases_book_id'), table_name='book_purchases')
    op.drop_table('book_purchases')
    op.drop_index(op.f('ix_books_school_id'), table_name='books')
    op.drop_table('books')
