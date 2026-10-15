"""roles is_system and version

Revision ID: 492d3c002ca9
Revises: 7cb2030948f9
Create Date: 2026-09-25 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '492d3c002ca9'
down_revision: Union[str, None] = '7cb2030948f9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Roles sembrados por app/core/permissions.py::DEFAULT_ROLE_PERMISSIONS; se marcan
# is_system=true al backfillear (su code/name queda protegido, ver identity/models.py).
_SEEDED_ROLE_CODES = (
    "school_admin",
    "coordinator",
    "teacher",
    "student",
    "guardian",
    "finance",
    "public_site_editor",
)


def upgrade() -> None:
    op.add_column(
        "roles", sa.Column("is_system", sa.Boolean(), nullable=False, server_default="false")
    )
    op.add_column(
        "roles", sa.Column("version", sa.Integer(), nullable=False, server_default="1")
    )
    op.alter_column("roles", "is_system", server_default=None)
    op.alter_column("roles", "version", server_default=None)

    roles = sa.table("roles", sa.column("code", sa.String), sa.column("is_system", sa.Boolean))
    op.execute(
        roles.update()
        .where(roles.c.code.in_(_SEEDED_ROLE_CODES))
        .values(is_system=True)
    )


def downgrade() -> None:
    op.drop_column("roles", "version")
    op.drop_column("roles", "is_system")
