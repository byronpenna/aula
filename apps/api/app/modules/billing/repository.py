from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.modules.billing.models import (
    Payment,
    PaymentPlan,
    PaymentPlanInstallment,
    PaymentTransaction,
    StudentInstallment,
    StudentPaymentPlan,
)


def list_payment_plans(
    db: Session, school_id: uuid.UUID, academic_year_id: uuid.UUID
) -> list[PaymentPlan]:
    stmt = select(PaymentPlan).where(
        PaymentPlan.school_id == school_id, PaymentPlan.academic_year_id == academic_year_id
    ).order_by(PaymentPlan.created_at)
    return list(db.execute(stmt).scalars().all())


def get_payment_plan(db: Session, school_id: uuid.UUID, plan_id: uuid.UUID) -> PaymentPlan | None:
    stmt = select(PaymentPlan).where(PaymentPlan.id == plan_id, PaymentPlan.school_id == school_id)
    return db.execute(stmt).scalar_one_or_none()


def list_plan_installments(db: Session, plan_id: uuid.UUID) -> list[PaymentPlanInstallment]:
    stmt = select(PaymentPlanInstallment).where(
        PaymentPlanInstallment.payment_plan_id == plan_id
    ).order_by(PaymentPlanInstallment.due_date)
    return list(db.execute(stmt).scalars().all())


def get_active_student_payment_plan(
    db: Session, school_id: uuid.UUID, student_id: uuid.UUID, academic_year_id: uuid.UUID
) -> StudentPaymentPlan | None:
    stmt = select(StudentPaymentPlan).where(
        StudentPaymentPlan.school_id == school_id,
        StudentPaymentPlan.student_id == student_id,
        StudentPaymentPlan.academic_year_id == academic_year_id,
        StudentPaymentPlan.status == "active",
    )
    return db.execute(stmt).scalar_one_or_none()


def list_student_installments(
    db: Session, student_payment_plan_id: uuid.UUID
) -> list[StudentInstallment]:
    stmt = select(StudentInstallment).where(
        StudentInstallment.student_payment_plan_id == student_payment_plan_id
    ).order_by(StudentInstallment.due_date)
    return list(db.execute(stmt).scalars().all())


def get_student_installment(
    db: Session, school_id: uuid.UUID, installment_id: uuid.UUID
) -> StudentInstallment | None:
    stmt = select(StudentInstallment).where(
        StudentInstallment.id == installment_id, StudentInstallment.school_id == school_id
    )
    return db.execute(stmt).scalar_one_or_none()


def get_payment_for_installment(
    db: Session, school_id: uuid.UUID, student_installment_id: uuid.UUID
) -> Payment | None:
    stmt = select(Payment).where(
        Payment.school_id == school_id, Payment.student_installment_id == student_installment_id
    )
    return db.execute(stmt).scalar_one_or_none()


def get_payment_transaction(
    db: Session, school_id: uuid.UUID, transaction_id: uuid.UUID
) -> PaymentTransaction | None:
    stmt = select(PaymentTransaction).where(
        PaymentTransaction.id == transaction_id, PaymentTransaction.school_id == school_id
    )
    return db.execute(stmt).scalar_one_or_none()


def count_payments_for_transaction(db: Session, transaction_id: uuid.UUID) -> int:
    stmt = select(Payment).where(Payment.payment_transaction_id == transaction_id)
    return len(db.execute(stmt).scalars().all())
