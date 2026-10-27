"""file notes

Revision ID: a3f1c9d2e4b7
Revises: f6a2a11e9ce7
Create Date: 2026-10-16 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3f1c9d2e4b7'
down_revision: Union[str, None] = 'f6a2a11e9ce7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('file_notes',
    sa.Column('file_id', sa.UUID(), nullable=False),
    sa.Column('author_user_id', sa.UUID(), nullable=False),
    sa.Column('page_number', sa.Integer(), nullable=False),
    sa.Column('x', sa.Float(), nullable=True),
    sa.Column('y', sa.Float(), nullable=True),
    sa.Column('body', sa.String(), nullable=False),
    sa.Column('id', sa.UUID(), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('school_id', sa.UUID(), nullable=False),
    sa.ForeignKeyConstraint(['author_user_id'], ['users.id'], ),
    sa.ForeignKeyConstraint(['file_id'], ['files.id'], ),
    sa.ForeignKeyConstraint(['school_id'], ['schools.id'], ),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_file_notes_file_id'), 'file_notes', ['file_id'], unique=False)
    op.create_index(op.f('ix_file_notes_school_id'), 'file_notes', ['school_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_file_notes_school_id'), table_name='file_notes')
    op.drop_index(op.f('ix_file_notes_file_id'), table_name='file_notes')
    op.drop_table('file_notes')
