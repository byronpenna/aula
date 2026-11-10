"""user handle

Revision ID: b1a2c3d4e5f6
Revises: fdcffd73f2f8
Create Date: 2026-11-04 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'b1a2c3d4e5f6'
down_revision: Union[str, None] = 'fdcffd73f2f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('handle', sa.String(), nullable=True))
    op.create_unique_constraint('uq_users_handle', 'users', ['handle'])


def downgrade() -> None:
    op.drop_constraint('uq_users_handle', 'users', type_='unique')
    op.drop_column('users', 'handle')
