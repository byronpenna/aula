"""guardian_profiles

Escrita a mano (no solo autogenerate) porque además de crear
`guardian_profiles` hay que migrar datos: `guardian_student_links` dejaba de
apuntar a `User.id` directamente y pasa a apuntar a `GuardianProfile.id`, así
que cada (colegio, usuario) que ya tenga al menos un vínculo hoy recibe un
perfil nuevo, reutilizando lo que ya existe en `User` (nombre, correo,
teléfono).

Revision ID: 7c3f9a2e1b4d
Revises: f5170a11c51d
Create Date: 2026-11-11 11:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '7c3f9a2e1b4d'
down_revision: Union[str, None] = 'f5170a11c51d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'guardian_profiles',
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('full_name', sa.String(), nullable=False),
        sa.Column('email', sa.String(), nullable=True),
        sa.Column('phone', sa.String(), nullable=True),
        sa.Column('profession', sa.String(), nullable=True),
        sa.Column('workplace', sa.String(), nullable=True),
        sa.Column('national_id', sa.String(), nullable=True),
        sa.Column('address', sa.String(), nullable=True),
        sa.Column('notes', sa.String(), nullable=True),
        sa.Column('photo_file_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('school_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.ForeignKeyConstraint(['photo_file_id'], ['files.id']),
        sa.ForeignKeyConstraint(['school_id'], ['schools.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_guardian_profiles_school_id'), 'guardian_profiles', ['school_id'], unique=False
    )

    # Un perfil por cada (colegio, usuario) que ya tenga al menos un vínculo
    # activo o inactivo hoy, reutilizando los datos que ya existen en `User`.
    op.execute(
        """
        INSERT INTO guardian_profiles (id, school_id, user_id, full_name, email, phone, created_at, updated_at)
        SELECT gen_random_uuid(), x.school_id, x.guardian_user_id, u.display_name, u.email, u.phone, now(), now()
        FROM (SELECT DISTINCT school_id, guardian_user_id FROM guardian_student_links) x
        JOIN users u ON u.id = x.guardian_user_id
        """
    )

    op.add_column(
        'guardian_student_links', sa.Column('guardian_id', postgresql.UUID(as_uuid=True), nullable=True)
    )
    op.execute(
        """
        UPDATE guardian_student_links gsl
        SET guardian_id = gp.id
        FROM guardian_profiles gp
        WHERE gp.school_id = gsl.school_id AND gp.user_id = gsl.guardian_user_id
        """
    )
    op.alter_column('guardian_student_links', 'guardian_id', nullable=False)
    op.create_foreign_key(
        'guardian_student_links_guardian_id_fkey',
        'guardian_student_links', 'guardian_profiles',
        ['guardian_id'], ['id'],
    )
    op.drop_constraint(
        'guardian_student_links_guardian_user_id_fkey', 'guardian_student_links', type_='foreignkey'
    )
    op.drop_column('guardian_student_links', 'guardian_user_id')


def downgrade() -> None:
    op.add_column(
        'guardian_student_links', sa.Column('guardian_user_id', postgresql.UUID(as_uuid=True), nullable=True)
    )
    op.execute(
        """
        UPDATE guardian_student_links gsl
        SET guardian_user_id = gp.user_id
        FROM guardian_profiles gp
        WHERE gp.id = gsl.guardian_id
        """
    )
    op.alter_column('guardian_student_links', 'guardian_user_id', nullable=False)
    op.create_foreign_key(
        'guardian_student_links_guardian_user_id_fkey',
        'guardian_student_links', 'users',
        ['guardian_user_id'], ['id'],
    )
    op.drop_constraint(
        'guardian_student_links_guardian_id_fkey', 'guardian_student_links', type_='foreignkey'
    )
    op.drop_column('guardian_student_links', 'guardian_id')

    op.drop_index(op.f('ix_guardian_profiles_school_id'), table_name='guardian_profiles')
    op.drop_table('guardian_profiles')
