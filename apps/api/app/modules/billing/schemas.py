from __future__ import annotations

import uuid
from datetime import date
from decimal import Decimal

from pydantic import BaseModel, ConfigDict


class PaymentPlanCreate(BaseModel):
    name: str
    total_amount: Decimal


class PaymentPlanUpdate(BaseModel):
    name: str | None = None
    total_amount: Decimal | None = None


class PaymentPlanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    academic_year_id: uuid.UUID
    name: str
    total_amount: Decimal
    status: str


class PaymentPlanInstallmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    payment_plan_id: uuid.UUID
    due_date: date
    amount: Decimal


class PaymentPlanWithInstallmentsOut(BaseModel):
    plan: PaymentPlanOut
    installments: list[PaymentPlanInstallmentOut]


class InstallmentMonthsSet(BaseModel):
    due_dates: list[date]


class EnrolledStudentOut(BaseModel):
    id: uuid.UUID
    student_number: str
    display_name: str | None
    section_id: uuid.UUID
    has_payment_plan: bool


class AssignPlanRequest(BaseModel):
    payment_plan_id: uuid.UUID


class PaymentTransactionCreate(BaseModel):
    """Contabilidad (sección nueva): una transacción puede cubrir varias
    mensualidades del mismo alumno a la vez. `amount_tendered` obligatorio en
    efectivo (para calcular el vuelto); `authorization_number` obligatorio en
    tarjeta — ambos validados en el service, nunca solo aquí."""

    student_installment_ids: list[uuid.UUID]
    method: str  # "cash" | "card"
    authorization_number: str | None = None
    amount_tendered: Decimal | None = None
    paid_at: date | None = None


class PaymentTransactionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID
    method: str
    authorization_number: str | None
    amount_tendered: Decimal | None
    amount_total: Decimal
    change_given: Decimal | None
    paid_at: date
    recorded_by_user_id: uuid.UUID


class PaymentOut(BaseModel):
    """Vista liviana del pago de UNA mensualidad para StudentInstallmentOut: trae
    lo esencial de su PaymentTransaction (método/autorización/fecha) sin anidar
    el objeto completo — el total/vuelto de la transacción se consulta aparte en
    Contabilidad si hace falta (GET /payment-transactions/{id})."""

    id: uuid.UUID
    payment_transaction_id: uuid.UUID
    method: str
    authorization_number: str | None
    paid_at: date


class StudentInstallmentOut(BaseModel):
    id: uuid.UUID
    due_date: date
    amount: Decimal
    status: str
    # "paid" | "pending" | "overdue": calculado al leer (nunca guardado), nunca
    # confundir con `status`, que solo guarda "pending"/"paid" — ver
    # billing/service.py::effective_status.
    effective_status: str
    payment: PaymentOut | None = None


class StudentPaymentPlanOut(BaseModel):
    id: uuid.UUID
    student_id: uuid.UUID
    academic_year_id: uuid.UUID
    payment_plan_id: uuid.UUID
    payment_plan_name: str
    status: str
    installments: list[StudentInstallmentOut]
