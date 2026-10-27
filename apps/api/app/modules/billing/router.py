from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.deps import CurrentMembership, get_current_user, require_permission
from app.core.permissions import BILLING_MANAGE, COURSE_READ
from app.db.session import get_db
from app.modules.billing import repository as billing_repo
from app.modules.billing import service as billing_service
from app.modules.billing.models import PaymentPlan, StudentInstallment, StudentPaymentPlan
from app.modules.billing.schemas import (
    AssignPlanRequest,
    EnrolledStudentOut,
    InstallmentMonthsSet,
    PaymentOut,
    PaymentPlanCreate,
    PaymentPlanInstallmentOut,
    PaymentPlanOut,
    PaymentPlanUpdate,
    PaymentPlanWithInstallmentsOut,
    PaymentTransactionCreate,
    PaymentTransactionOut,
    StudentInstallmentOut,
    StudentPaymentPlanOut,
)
from app.modules.identity.models import User

router = APIRouter(tags=["billing"])


def _plan_with_installments_out(plan: PaymentPlan, installments) -> PaymentPlanWithInstallmentsOut:
    return PaymentPlanWithInstallmentsOut(
        plan=PaymentPlanOut.model_validate(plan),
        installments=[PaymentPlanInstallmentOut.model_validate(i) for i in installments],
    )


def _student_installment_out(
    db: Session, school_id, installment: StudentInstallment
) -> StudentInstallmentOut:
    payment = billing_repo.get_payment_for_installment(db, school_id, installment.id)
    payment_out = None
    if payment is not None:
        transaction = billing_repo.get_payment_transaction(
            db, school_id, payment.payment_transaction_id
        )
        payment_out = PaymentOut(
            id=payment.id,
            payment_transaction_id=payment.payment_transaction_id,
            method=transaction.method,
            authorization_number=transaction.authorization_number,
            paid_at=transaction.paid_at,
        )
    return StudentInstallmentOut(
        id=installment.id,
        due_date=installment.due_date,
        amount=installment.amount,
        status=installment.status,
        effective_status=billing_service.effective_status(installment),
        payment=payment_out,
    )


def _student_payment_plan_out(
    db: Session,
    school_id,
    assignment: StudentPaymentPlan,
    plan: PaymentPlan,
    installments: list[StudentInstallment],
) -> StudentPaymentPlanOut:
    return StudentPaymentPlanOut(
        id=assignment.id,
        student_id=assignment.student_id,
        academic_year_id=assignment.academic_year_id,
        payment_plan_id=assignment.payment_plan_id,
        payment_plan_name=plan.name,
        status=assignment.status,
        installments=[_student_installment_out(db, school_id, i) for i in installments],
    )


@router.post("/academic-years/{academic_year_id}/payment-plans", response_model=PaymentPlanOut)
def create_payment_plan(
    academic_year_id: uuid.UUID,
    payload: PaymentPlanCreate,
    request: Request,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(BILLING_MANAGE)),
) -> PaymentPlan:
    return billing_service.create_payment_plan(
        db, current, academic_year_id, payload.name, payload.total_amount, request.state.request_id
    )


@router.get(
    "/academic-years/{academic_year_id}/payment-plans",
    response_model=list[PaymentPlanWithInstallmentsOut],
)
def list_payment_plans(
    academic_year_id: uuid.UUID,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(BILLING_MANAGE)),
) -> list[PaymentPlanWithInstallmentsOut]:
    rows = billing_service.list_payment_plans_with_installments(db, current, academic_year_id)
    return [_plan_with_installments_out(plan, installments) for plan, installments in rows]


@router.patch("/payment-plans/{plan_id}", response_model=PaymentPlanOut)
def update_payment_plan(
    plan_id: uuid.UUID,
    payload: PaymentPlanUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(BILLING_MANAGE)),
) -> PaymentPlan:
    return billing_service.update_payment_plan(
        db, current, plan_id, payload.name, payload.total_amount, request.state.request_id
    )


@router.post("/payment-plans/{plan_id}/archive", response_model=PaymentPlanOut)
def archive_payment_plan(
    plan_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(BILLING_MANAGE)),
) -> PaymentPlan:
    return billing_service.set_plan_status(db, current, plan_id, "archived", request.state.request_id)


@router.post("/payment-plans/{plan_id}/activate", response_model=PaymentPlanOut)
def activate_payment_plan(
    plan_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(BILLING_MANAGE)),
) -> PaymentPlan:
    return billing_service.set_plan_status(db, current, plan_id, "active", request.state.request_id)


@router.post(
    "/payment-plans/{plan_id}/installments", response_model=list[PaymentPlanInstallmentOut]
)
def set_plan_installments(
    plan_id: uuid.UUID,
    payload: InstallmentMonthsSet,
    request: Request,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(BILLING_MANAGE)),
):
    return billing_service.set_plan_installments(
        db, current, plan_id, payload.due_dates, request.state.request_id
    )


@router.get(
    "/academic-years/{academic_year_id}/enrolled-students",
    response_model=list[EnrolledStudentOut],
)
def list_enrolled_students(
    academic_year_id: uuid.UUID,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(BILLING_MANAGE)),
) -> list[EnrolledStudentOut]:
    rows = billing_service.list_enrolled_students(db, current, academic_year_id)
    return [EnrolledStudentOut(**row) for row in rows]


@router.post(
    "/academic-years/{academic_year_id}/students/{student_id}/payment-plan",
    response_model=StudentPaymentPlanOut,
)
def assign_payment_plan(
    academic_year_id: uuid.UUID,
    student_id: uuid.UUID,
    payload: AssignPlanRequest,
    request: Request,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(BILLING_MANAGE)),
) -> StudentPaymentPlanOut:
    assignment, plan, installments = billing_service.assign_plan_to_student(
        db, current, academic_year_id, student_id, payload.payment_plan_id, request.state.request_id
    )
    return _student_payment_plan_out(db, current.school_id, assignment, plan, installments)


@router.get(
    "/academic-years/{academic_year_id}/students/{student_id}/payment-plan",
    response_model=StudentPaymentPlanOut | None,
)
def get_student_payment_plan(
    academic_year_id: uuid.UUID,
    student_id: uuid.UUID,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(BILLING_MANAGE)),
) -> StudentPaymentPlanOut | None:
    result = billing_service.get_student_payment_plan(db, current, academic_year_id, student_id)
    if result is None:
        return None
    assignment, plan, installments = result
    return _student_payment_plan_out(db, current.school_id, assignment, plan, installments)


@router.get(
    "/students/{student_id}/payment-status",
    response_model=StudentPaymentPlanOut | None,
)
def get_student_payment_status(
    student_id: uuid.UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    current: CurrentMembership = Depends(require_permission(COURSE_READ)),
) -> StudentPaymentPlanOut | None:
    """Ficha del alumno (sección nueva, /students/:id): docente que comparte un
    curso con él, o admin/coordinación — ver
    academics_service.require_student_billing_access. Usa el año académico activo
    del colegio; sin año activo o sin plan asignado, no es un error."""
    result = billing_service.get_student_payment_status(db, current, user.id, student_id)
    if result is None:
        return None
    assignment, plan, installments = result
    return _student_payment_plan_out(db, current.school_id, assignment, plan, installments)


@router.post("/payment-transactions", response_model=PaymentTransactionOut)
def record_payment_transaction(
    payload: PaymentTransactionCreate,
    request: Request,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
    current: CurrentMembership = Depends(require_permission(BILLING_MANAGE)),
) -> PaymentTransactionOut:
    """Contabilidad (sección nueva): un cobro puede cubrir varias mensualidades del
    mismo alumno a la vez; efectivo o tarjeta — con tarjeta, el número de
    autorización es obligatorio; con efectivo, el monto entregado lo es, para
    calcular el vuelto (billing_service.record_payment_transaction)."""
    transaction, _installments = billing_service.record_payment_transaction(
        db,
        current,
        user.id,
        payload.student_installment_ids,
        payload.method,
        payload.authorization_number,
        payload.amount_tendered,
        payload.paid_at,
        request.state.request_id,
    )
    return PaymentTransactionOut.model_validate(transaction)


@router.delete(
    "/student-installments/{installment_id}/payments", response_model=StudentInstallmentOut
)
def void_payment(
    installment_id: uuid.UUID,
    request: Request,
    db: Session = Depends(get_db),
    current: CurrentMembership = Depends(require_permission(BILLING_MANAGE)),
) -> StudentInstallmentOut:
    installment = billing_service.void_payment(db, current, installment_id, request.state.request_id)
    return _student_installment_out(db, current.school_id, installment)
