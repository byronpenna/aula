"""identity, academics y learning (fase 0/1)

Revision ID: f6ea9df6c91c
Revises:
Create Date: 2026-09-10 20:24:26.989764

Nota: el autogenerate de Alembic no pudo ordenar correctamente las tablas por el
ciclo `submissions.current_revision_id -> submission_revisions.id` y
`submission_revisions.submission_id -> submissions.id` (ver advertencia de SQLAlchemy
en `alembic/env.py`). Este archivo fue reordenado a mano siguiendo las dependencias
reales del modelo (sección 7); `submissions` se crea sin la FK circular y esta se
añade con `op.create_foreign_key` una vez existe `submission_revisions`.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'f6ea9df6c91c'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table('permissions',
        sa.Column('code', sa.String(), nullable=False),
        sa.Column('description', sa.String(), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code'),
    )
    op.create_table('roles',
        sa.Column('code', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('code'),
    )
    op.create_table('schools',
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('timezone', sa.String(), nullable=False),
        sa.Column('currency', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_table('users',
        sa.Column('cognito_sub', sa.String(), nullable=True),
        sa.Column('display_name', sa.String(), nullable=False),
        sa.Column('email', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('cognito_sub'),
    )
    op.create_table('academic_years',
        sa.Column('label', sa.String(), nullable=False),
        sa.Column('starts_on', sa.Date(), nullable=False),
        sa.Column('ends_on', sa.Date(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('school_id', sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(['school_id'], ['schools.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_academic_years_school_id'), 'academic_years', ['school_id'], unique=False)

    op.create_table('grade_levels',
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('sort_order', sa.Integer(), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('school_id', sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(['school_id'], ['schools.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_grade_levels_school_id'), 'grade_levels', ['school_id'], unique=False)

    op.create_table('subjects',
        sa.Column('code', sa.String(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('school_id', sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(['school_id'], ['schools.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('school_id', 'code', name='uq_subject_code_per_school'),
    )
    op.create_index(op.f('ix_subjects_school_id'), 'subjects', ['school_id'], unique=False)

    op.create_table('sections',
        sa.Column('academic_year_id', sa.UUID(), nullable=False),
        sa.Column('grade_level_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('school_id', sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(['academic_year_id'], ['academic_years.id'], ),
        sa.ForeignKeyConstraint(['grade_level_id'], ['grade_levels.id'], ),
        sa.ForeignKeyConstraint(['school_id'], ['schools.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('academic_year_id', 'grade_level_id', 'name', name='uq_section_year_grade_name'),
    )
    op.create_index(op.f('ix_sections_school_id'), 'sections', ['school_id'], unique=False)

    op.create_table('courses',
        sa.Column('section_id', sa.UUID(), nullable=False),
        sa.Column('subject_id', sa.UUID(), nullable=False),
        sa.Column('academic_year_id', sa.UUID(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('school_id', sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(['academic_year_id'], ['academic_years.id'], ),
        sa.ForeignKeyConstraint(['school_id'], ['schools.id'], ),
        sa.ForeignKeyConstraint(['section_id'], ['sections.id'], ),
        sa.ForeignKeyConstraint(['subject_id'], ['subjects.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('section_id', 'subject_id', 'academic_year_id', name='uq_course_section_subject_year'),
    )
    op.create_index(op.f('ix_courses_school_id'), 'courses', ['school_id'], unique=False)

    op.create_table('course_teachers',
        sa.Column('course_id', sa.UUID(), nullable=False),
        sa.Column('teacher_user_id', sa.UUID(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('school_id', sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(['course_id'], ['courses.id'], ),
        sa.ForeignKeyConstraint(['school_id'], ['schools.id'], ),
        sa.ForeignKeyConstraint(['teacher_user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('course_id', 'teacher_user_id', name='uq_course_teacher'),
    )
    op.create_index(op.f('ix_course_teachers_school_id'), 'course_teachers', ['school_id'], unique=False)

    op.create_table('student_profiles',
        sa.Column('user_id', sa.UUID(), nullable=True),
        sa.Column('student_number', sa.String(), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('school_id', sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(['school_id'], ['schools.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('school_id', 'student_number', name='uq_student_number_per_school'),
    )
    op.create_index(op.f('ix_student_profiles_school_id'), 'student_profiles', ['school_id'], unique=False)

    op.create_table('enrollments',
        sa.Column('academic_year_id', sa.UUID(), nullable=False),
        sa.Column('student_id', sa.UUID(), nullable=False),
        sa.Column('section_id', sa.UUID(), nullable=False),
        sa.Column('starts_on', sa.Date(), nullable=False),
        sa.Column('ends_on', sa.Date(), nullable=True),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('school_id', sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(['academic_year_id'], ['academic_years.id'], ),
        sa.ForeignKeyConstraint(['school_id'], ['schools.id'], ),
        sa.ForeignKeyConstraint(['section_id'], ['sections.id'], ),
        sa.ForeignKeyConstraint(['student_id'], ['student_profiles.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_enrollments_school_id'), 'enrollments', ['school_id'], unique=False)

    op.create_table('course_enrollments',
        sa.Column('course_id', sa.UUID(), nullable=False),
        sa.Column('student_id', sa.UUID(), nullable=False),
        sa.Column('enrollment_id', sa.UUID(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('school_id', sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(['course_id'], ['courses.id'], ),
        sa.ForeignKeyConstraint(['enrollment_id'], ['enrollments.id'], ),
        sa.ForeignKeyConstraint(['school_id'], ['schools.id'], ),
        sa.ForeignKeyConstraint(['student_id'], ['student_profiles.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('course_id', 'student_id', name='uq_course_enrollment_student'),
    )
    op.create_index(op.f('ix_course_enrollments_school_id'), 'course_enrollments', ['school_id'], unique=False)

    op.create_table('grading_periods',
        sa.Column('academic_year_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(), nullable=False),
        sa.Column('starts_on', sa.Date(), nullable=False),
        sa.Column('ends_on', sa.Date(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('school_id', sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(['academic_year_id'], ['academic_years.id'], ),
        sa.ForeignKeyConstraint(['school_id'], ['schools.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_grading_periods_school_id'), 'grading_periods', ['school_id'], unique=False)

    op.create_table('assignments',
        sa.Column('course_id', sa.UUID(), nullable=False),
        sa.Column('title', sa.String(), nullable=False),
        sa.Column('instructions', sa.String(), nullable=False),
        sa.Column('due_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('max_score', sa.Numeric(precision=6, scale=2), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('allow_late', sa.Boolean(), nullable=False),
        sa.Column('grading_period_id', sa.UUID(), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('school_id', sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(['course_id'], ['courses.id'], ),
        sa.ForeignKeyConstraint(['grading_period_id'], ['grading_periods.id'], ),
        sa.ForeignKeyConstraint(['school_id'], ['schools.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_assignments_school_id'), 'assignments', ['school_id'], unique=False)

    # `submissions` se crea sin la FK circular hacia submission_revisions; se añade
    # más abajo con ALTER TABLE una vez que esa tabla existe.
    op.create_table('submissions',
        sa.Column('assignment_id', sa.UUID(), nullable=False),
        sa.Column('student_id', sa.UUID(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('current_revision_id', sa.UUID(), nullable=True),
        sa.Column('submitted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('school_id', sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(['assignment_id'], ['assignments.id'], ),
        sa.ForeignKeyConstraint(['school_id'], ['schools.id'], ),
        sa.ForeignKeyConstraint(['student_id'], ['student_profiles.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('assignment_id', 'student_id', name='uq_submission_assignment_student'),
    )
    op.create_index(op.f('ix_submissions_school_id'), 'submissions', ['school_id'], unique=False)

    op.create_table('submission_revisions',
        sa.Column('submission_id', sa.UUID(), nullable=False),
        sa.Column('revision_number', sa.Integer(), nullable=False),
        sa.Column('body', sa.String(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(['submission_id'], ['submissions.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('submission_id', 'revision_number', name='uq_revision_per_submission'),
    )

    op.create_foreign_key(
        'fk_submissions_current_revision_id_submission_revisions',
        'submissions', 'submission_revisions',
        ['current_revision_id'], ['id'],
    )

    op.create_table('role_permissions',
        sa.Column('role_id', sa.UUID(), nullable=False),
        sa.Column('permission_id', sa.UUID(), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['permission_id'], ['permissions.id'], ),
        sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('role_id', 'permission_id', name='uq_role_permission'),
    )

    op.create_table('school_memberships',
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('school_id', sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(['school_id'], ['schools.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('school_id', 'user_id', name='uq_membership_school_user'),
    )
    op.create_index(op.f('ix_school_memberships_school_id'), 'school_memberships', ['school_id'], unique=False)

    op.create_table('membership_roles',
        sa.Column('membership_id', sa.UUID(), nullable=False),
        sa.Column('role_id', sa.UUID(), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['membership_id'], ['school_memberships.id'], ),
        sa.ForeignKeyConstraint(['role_id'], ['roles.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('membership_id', 'role_id', name='uq_membership_role'),
    )

    op.create_table('local_auth_credentials',
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('username', sa.String(), nullable=False),
        sa.Column('password_hash', sa.String(), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id'),
        sa.UniqueConstraint('username'),
    )

    op.create_table('guardian_student_links',
        sa.Column('guardian_user_id', sa.UUID(), nullable=False),
        sa.Column('student_id', sa.UUID(), nullable=False),
        sa.Column('relationship_label', sa.String(), nullable=False),
        sa.Column('status', sa.String(), nullable=False),
        sa.Column('valid_from', sa.Date(), nullable=False),
        sa.Column('valid_to', sa.Date(), nullable=True),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('school_id', sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(['guardian_user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['school_id'], ['schools.id'], ),
        sa.ForeignKeyConstraint(['student_id'], ['student_profiles.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_guardian_student_links_school_id'), 'guardian_student_links', ['school_id'], unique=False)

    op.create_table('audit_events',
        sa.Column('school_id', sa.UUID(), nullable=True),
        sa.Column('actor_id', sa.UUID(), nullable=True),
        sa.Column('action', sa.String(), nullable=False),
        sa.Column('target_type', sa.String(), nullable=False),
        sa.Column('target_id', sa.String(), nullable=False),
        sa.Column('request_id', sa.String(), nullable=True),
        sa.Column('changes', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('occurred_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(['actor_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['school_id'], ['schools.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_audit_events_school_id'), 'audit_events', ['school_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_audit_events_school_id'), table_name='audit_events')
    op.drop_table('audit_events')
    op.drop_index(op.f('ix_guardian_student_links_school_id'), table_name='guardian_student_links')
    op.drop_table('guardian_student_links')
    op.drop_table('local_auth_credentials')
    op.drop_table('membership_roles')
    op.drop_index(op.f('ix_school_memberships_school_id'), table_name='school_memberships')
    op.drop_table('school_memberships')
    op.drop_table('role_permissions')

    op.drop_constraint(
        'fk_submissions_current_revision_id_submission_revisions',
        'submissions', type_='foreignkey',
    )
    op.drop_table('submission_revisions')
    op.drop_index(op.f('ix_submissions_school_id'), table_name='submissions')
    op.drop_table('submissions')

    op.drop_index(op.f('ix_assignments_school_id'), table_name='assignments')
    op.drop_table('assignments')
    op.drop_index(op.f('ix_grading_periods_school_id'), table_name='grading_periods')
    op.drop_table('grading_periods')
    op.drop_index(op.f('ix_course_enrollments_school_id'), table_name='course_enrollments')
    op.drop_table('course_enrollments')
    op.drop_index(op.f('ix_enrollments_school_id'), table_name='enrollments')
    op.drop_table('enrollments')
    op.drop_index(op.f('ix_student_profiles_school_id'), table_name='student_profiles')
    op.drop_table('student_profiles')
    op.drop_index(op.f('ix_course_teachers_school_id'), table_name='course_teachers')
    op.drop_table('course_teachers')
    op.drop_index(op.f('ix_courses_school_id'), table_name='courses')
    op.drop_table('courses')
    op.drop_index(op.f('ix_sections_school_id'), table_name='sections')
    op.drop_table('sections')
    op.drop_index(op.f('ix_subjects_school_id'), table_name='subjects')
    op.drop_table('subjects')
    op.drop_index(op.f('ix_grade_levels_school_id'), table_name='grade_levels')
    op.drop_table('grade_levels')
    op.drop_index(op.f('ix_academic_years_school_id'), table_name='academic_years')
    op.drop_table('academic_years')
    op.drop_table('users')
    op.drop_table('schools')
    op.drop_table('roles')
    op.drop_table('permissions')
