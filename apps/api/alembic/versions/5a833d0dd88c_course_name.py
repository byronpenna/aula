"""course name

Revision ID: 5a833d0dd88c
Revises: 0bb0c0e7ffe4
Create Date: 2026-10-15 19:32:00.674517

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5a833d0dd88c'
down_revision: Union[str, None] = '0bb0c0e7ffe4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Nullable: la mayoría de cursos existentes no tienen nombre propio todavía
    # (hoy se muestran como "Curso {id[:8]}" en el frontend); admin/coordinación
    # o el docente encargado lo ponen desde el detalle del curso cuando quieran.
    op.add_column("courses", sa.Column("name", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("courses", "name")
