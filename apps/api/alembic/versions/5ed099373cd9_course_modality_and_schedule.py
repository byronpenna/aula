"""course_modality_and_schedule

Revision ID: 5ed099373cd9
Revises: 7c3f9a2e1b4d
Create Date: 2026-11-11 12:57:59.418290

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '5ed099373cd9'
down_revision: Union[str, None] = '7c3f9a2e1b4d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Nota: el autogenerate también detectó 'content.news_posts' como "faltante"
    # (mismo falso positivo documentado en f6a2a11e9ce7_resource_sections.py) —
    # se quita aquí para no duplicarla/recrearla.

    # server_default aplica "virtual" a los cursos existentes en la misma
    # sentencia (mismo patrón que 7cb2030948f9_academic_catalog_status_columns.py);
    # se retira después de poblar para que el valor por defecto viva solo en el
    # modelo ORM, no en la DB.
    op.add_column(
        "courses", sa.Column("modality", sa.String(), nullable=False, server_default="virtual")
    )
    op.alter_column("courses", "modality", server_default=None)

    op.create_table(
        "course_schedule_slots",
        sa.Column("course_id", sa.UUID(), nullable=False),
        sa.Column("weekday", sa.Integer(), nullable=False),
        sa.Column("start_time", sa.Time(), nullable=False),
        sa.Column("end_time", sa.Time(), nullable=False),
        sa.Column("location", sa.String(), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("school_id", sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(["course_id"], ["courses.id"]),
        sa.ForeignKeyConstraint(["school_id"], ["schools.id"]),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        op.f("ix_course_schedule_slots_course_id"), "course_schedule_slots", ["course_id"], unique=False
    )
    op.create_index(
        op.f("ix_course_schedule_slots_school_id"), "course_schedule_slots", ["school_id"], unique=False
    )


def downgrade() -> None:
    op.drop_index(op.f("ix_course_schedule_slots_school_id"), table_name="course_schedule_slots")
    op.drop_index(op.f("ix_course_schedule_slots_course_id"), table_name="course_schedule_slots")
    op.drop_table("course_schedule_slots")
    op.drop_column("courses", "modality")
