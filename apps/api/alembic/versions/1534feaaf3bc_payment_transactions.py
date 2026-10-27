"""payment transactions

Revision ID: 1534feaaf3bc
Revises: 2ebfd7fc75a8
Create Date: 2026-10-20 13:14:19.995183

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = '1534feaaf3bc'
down_revision: Union[str, None] = '2ebfd7fc75a8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Nota: el autogenerate también detectó 'content.news_posts' como "faltante"
    # (alembic/env.py no compara con include_schemas=True y esa tabla vive en el
    # schema no default 'content'); se quita aquí, no es parte de esta entrega —
    # mismo caso ya documentado en 5a833d0dd88c_course_name.py.
    op.create_table(
        'payment_transactions',
        sa.Column('method', sa.String(), nullable=False),
        sa.Column('authorization_number', sa.String(), nullable=True),
        sa.Column('amount_tendered', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('amount_total', sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column('change_given', sa.Numeric(precision=10, scale=2), nullable=True),
        sa.Column('paid_at', sa.Date(), nullable=False),
        sa.Column('recorded_by_user_id', sa.UUID(), nullable=False),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('school_id', sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(['recorded_by_user_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['school_id'], ['schools.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        op.f('ix_payment_transactions_school_id'), 'payment_transactions', ['school_id'], unique=False
    )

    # Un Payment viejo = una PaymentTransaction nueva de una sola mensualidad
    # (sección 7, nunca se pierde historial real): cada Payment ya existente trae
    # su propio method/authorization_number/paid_at/recorded_by_user_id, que se
    # copian tal cual a su nueva transacción antes de borrarlos de `payments`. La
    # columna `_legacy_payment_id` es temporal, solo para volver a enlazar cada
    # transacción nueva con el Payment del que salió; se borra al final.
    op.add_column('payments', sa.Column('payment_transaction_id', sa.UUID(), nullable=True))
    op.add_column('payment_transactions', sa.Column('_legacy_payment_id', sa.UUID(), nullable=True))
    op.execute(
        """
        INSERT INTO payment_transactions
            (id, school_id, method, authorization_number, amount_tendered, amount_total,
             change_given, paid_at, recorded_by_user_id, created_at, updated_at, _legacy_payment_id)
        SELECT
            gen_random_uuid(), p.school_id, p.method, p.authorization_number, NULL,
            si.amount, NULL, p.paid_at, p.recorded_by_user_id, p.created_at, p.updated_at, p.id
        FROM payments p
        JOIN student_installments si ON si.id = p.student_installment_id
        """
    )
    op.execute(
        """
        UPDATE payments p
        SET payment_transaction_id = pt.id
        FROM payment_transactions pt
        WHERE pt._legacy_payment_id = p.id
        """
    )
    op.drop_column('payment_transactions', '_legacy_payment_id')

    op.alter_column('payments', 'payment_transaction_id', nullable=False)
    op.drop_constraint('payments_recorded_by_user_id_fkey', 'payments', type_='foreignkey')
    op.create_foreign_key(None, 'payments', 'payment_transactions', ['payment_transaction_id'], ['id'])
    op.drop_column('payments', 'recorded_by_user_id')
    op.drop_column('payments', 'paid_at')
    op.drop_column('payments', 'method')
    op.drop_column('payments', 'authorization_number')


def downgrade() -> None:
    op.add_column('payments', sa.Column('authorization_number', sa.VARCHAR(), autoincrement=False, nullable=True))
    op.add_column('payments', sa.Column('method', sa.VARCHAR(), autoincrement=False, nullable=True))
    op.add_column('payments', sa.Column('paid_at', sa.DATE(), autoincrement=False, nullable=True))
    op.add_column('payments', sa.Column('recorded_by_user_id', sa.UUID(), autoincrement=False, nullable=True))
    op.execute(
        """
        UPDATE payments p
        SET method = pt.method,
            authorization_number = pt.authorization_number,
            paid_at = pt.paid_at,
            recorded_by_user_id = pt.recorded_by_user_id
        FROM payment_transactions pt
        WHERE pt.id = p.payment_transaction_id
        """
    )
    op.alter_column('payments', 'method', nullable=False)
    op.alter_column('payments', 'paid_at', nullable=False)
    op.alter_column('payments', 'recorded_by_user_id', nullable=False)
    op.drop_constraint(None, 'payments', type_='foreignkey')
    op.create_foreign_key('payments_recorded_by_user_id_fkey', 'payments', 'users', ['recorded_by_user_id'], ['id'])
    op.drop_column('payments', 'payment_transaction_id')
    op.drop_index(op.f('ix_payment_transactions_school_id'), table_name='payment_transactions')
    op.drop_table('payment_transactions')
