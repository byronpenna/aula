"""book file versions

Revision ID: 85415ab15c25
Revises: c47a9e21f6b3
Create Date: 2026-10-27 14:06:48.636458

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '85415ab15c25'
down_revision: Union[str, None] = 'c47a9e21f6b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# No se toca `content.news_posts` aquí: es el drift preexistente documentado
# (ya mencionado en c47a9e21f6b3_books_and_purchases.py) de una tabla creada a
# mano fuera de Alembic, no algo que esta migración deba crear.


def upgrade() -> None:
    op.create_table(
        'book_file_versions',
        sa.Column('book_id', sa.UUID(), nullable=False),
        sa.Column('filename', sa.String(), nullable=False),
        sa.Column('content_type', sa.String(), nullable=False),
        sa.Column('size_bytes', sa.Integer(), nullable=False),
        sa.Column('storage_key', sa.String(), nullable=False),
        sa.Column('is_active', sa.Boolean(), nullable=False),
        sa.Column('uploaded_by_user_id', sa.UUID(), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('school_id', sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(['book_id'], ['books.id'], ),
        sa.ForeignKeyConstraint(['school_id'], ['schools.id'], ),
        sa.ForeignKeyConstraint(['uploaded_by_user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_book_file_versions_book_id'), 'book_file_versions', ['book_id'], unique=False)
    op.create_index(op.f('ix_book_file_versions_school_id'), 'book_file_versions', ['school_id'], unique=False)

    # Backfill: todo libro que ya tenía un archivo digital (antes de que existiera
    # el historial de versiones) pasa a tener una única versión activa con esos
    # mismos datos, para no perder acceso a lo ya subido.
    op.execute(
        """
        INSERT INTO book_file_versions
            (id, school_id, book_id, filename, content_type, size_bytes, storage_key,
             is_active, uploaded_by_user_id, created_at, updated_at)
        SELECT gen_random_uuid(), school_id, id, file_filename, file_content_type,
               file_size_bytes, file_storage_key, true, NULL, created_at, updated_at
        FROM books
        WHERE file_storage_key IS NOT NULL
        """
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_book_file_versions_school_id'), table_name='book_file_versions')
    op.drop_index(op.f('ix_book_file_versions_book_id'), table_name='book_file_versions')
    op.drop_table('book_file_versions')
