"""merge heads

Revision ID: 0bb0c0e7ffe4
Revises: 134df864b099, 492d3c002ca9
Create Date: 2026-10-15 19:31:56.830219

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '0bb0c0e7ffe4'
down_revision: Union[str, None] = ('134df864b099', '492d3c002ca9')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
