"""student profile details

Revision ID: c2d3e4f5a6b7
Revises: b1a2c3d4e5f6
Create Date: 2026-11-09 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c2d3e4f5a6b7'
down_revision: Union[str, None] = 'b1a2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('student_profiles', sa.Column('first_name', sa.String(), nullable=True))
    op.add_column('student_profiles', sa.Column('last_name', sa.String(), nullable=True))
    op.add_column('student_profiles', sa.Column('birth_date', sa.Date(), nullable=True))
    op.add_column('student_profiles', sa.Column('photo_file_id', sa.UUID(), nullable=True))
    op.create_foreign_key(
        'fk_student_profiles_photo_file_id', 'student_profiles', 'files', ['photo_file_id'], ['id']
    )


def downgrade() -> None:
    op.drop_constraint('fk_student_profiles_photo_file_id', 'student_profiles', type_='foreignkey')
    op.drop_column('student_profiles', 'photo_file_id')
    op.drop_column('student_profiles', 'birth_date')
    op.drop_column('student_profiles', 'last_name')
    op.drop_column('student_profiles', 'first_name')
