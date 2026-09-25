"""academic catalog status columns

Revision ID: 7cb2030948f9
Revises: 719ad95e08f9
Create Date: 2026-09-24 22:05:15.439867

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7cb2030948f9'
down_revision: Union[str, None] = '719ad95e08f9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # server_default aplica "active" a las filas existentes en la misma sentencia
    # (paridad con Cursos/Años, que ya soportan archivar); se retira después de
    # poblar para que el valor por defecto viva solo en el modelo ORM, no en la DB.
    for table in ("grade_levels", "sections", "subjects"):
        op.add_column(
            table, sa.Column("status", sa.String(), nullable=False, server_default="active")
        )
        op.alter_column(table, "status", server_default=None)


def downgrade() -> None:
    op.drop_column('subjects', 'status')
    op.drop_column('sections', 'status')
    op.drop_column('grade_levels', 'status')
