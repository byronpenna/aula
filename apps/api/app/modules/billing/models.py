"""Planes de pago por año académico (módulo nuevo, permiso `billing:manage`, ya
reservado en `core/permissions.py` para el rol `finance`/`school_admin`).

Dos niveles, igual patrón que Course -> CourseEnrollment o Assignment ->
Submission: un catálogo por año (PaymentPlan + PaymentPlanInstallment, las
mensualidades "plantilla") y, al asignarlo a un alumno matriculado, una copia
congelada por alumno (StudentPaymentPlan + StudentInstallment) que no cambia si
el plantilla se edita después.
"""

from __future__ import annotations

import uuid
from decimal import Decimal
from datetime import date

from sqlalchemy import ForeignKey, Numeric, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, SchoolScopedMixin, TimestampMixin, UUIDPKMixin


class PaymentPlan(UUIDPKMixin, TimestampMixin, SchoolScopedMixin, Base):
    __tablename__ = "payment_plans"

    academic_year_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("academic_years.id"), nullable=False
    )
    name: Mapped[str] = mapped_column(nullable=False)
    total_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    # "active" | "archived" (baja lógica, mismo criterio que el resto del catálogo
    # académico): un plan archivado no admite nuevas asignaciones; los alumnos ya
    # asignados conservan sus mensualidades (StudentInstallment), que nunca
    # dependen de que el plan siga activo.
    status: Mapped[str] = mapped_column(nullable=False, default="active")


class PaymentPlanInstallment(UUIDPKMixin, TimestampMixin, SchoolScopedMixin, Base):
    """Una mensualidad "plantilla" del plan. `amount` sale de dividir
    `PaymentPlan.total_amount` entre la cantidad de meses elegidos, con el ajuste
    de redondeo en la última fecha (ver billing/service.py::_split_amount)."""

    __tablename__ = "payment_plan_installments"
    __table_args__ = (
        UniqueConstraint("payment_plan_id", "due_date", name="uq_plan_installment_due_date"),
    )

    payment_plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("payment_plans.id"), nullable=False
    )
    due_date: Mapped[date] = mapped_column(nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)


class StudentPaymentPlan(UUIDPKMixin, TimestampMixin, SchoolScopedMixin, Base):
    """Asignación de un plan a un alumno matriculado en el año (requiere una
    Enrollment activa en ese año, ver billing/service.py::assign_plan_to_student).
    "active" | "cancelled": reasignar un plan nuevo cancela el anterior en vez de
    borrarlo, para conservar el historial."""

    __tablename__ = "student_payment_plans"

    student_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("student_profiles.id"), nullable=False
    )
    academic_year_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("academic_years.id"), nullable=False
    )
    enrollment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("enrollments.id"), nullable=False
    )
    payment_plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("payment_plans.id"), nullable=False
    )
    status: Mapped[str] = mapped_column(nullable=False, default="active")


class StudentInstallment(UUIDPKMixin, TimestampMixin, SchoolScopedMixin, Base):
    """Mensualidad concreta de un alumno: copia de PaymentPlanInstallment al
    momento de asignar (sección 7, matrícula transaccional: todo o nada).
    "pending" | "paid" — pasa a "paid" solo al registrarle un Payment (nunca se
    marca pagada "a mano" sin esos datos, ver billing/service.py::record_payment)."""

    __tablename__ = "student_installments"

    student_payment_plan_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("student_payment_plans.id"), nullable=False
    )
    due_date: Mapped[date] = mapped_column(nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    status: Mapped[str] = mapped_column(nullable=False, default="pending")


class PaymentTransaction(UUIDPKMixin, TimestampMixin, SchoolScopedMixin, Base):
    """Un cobro de caja (módulo Contabilidad, sección nueva): puede cubrir varias
    mensualidades del MISMO alumno a la vez (billing/service.py::record_payment,
    valida que todas las StudentInstallment pertenezcan a un solo alumno). En
    efectivo, `amount_tendered` es obligatorio y `change_given` se calcula contra
    `amount_total` (la suma de las mensualidades cubiertas); en tarjeta ambos
    quedan en None y `authorization_number` es el obligatorio."""

    __tablename__ = "payment_transactions"

    method: Mapped[str] = mapped_column(nullable=False)
    authorization_number: Mapped[str | None] = mapped_column(nullable=True)
    amount_tendered: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    amount_total: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    change_given: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    paid_at: Mapped[date] = mapped_column(nullable=False)
    recorded_by_user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=False
    )


class Payment(UUIDPKMixin, TimestampMixin, SchoolScopedMixin, Base):
    """Una línea de PaymentTransaction: qué mensualidad puntual cubrió ese cobro.
    Una mensualidad tiene a lo sumo un Payment activo a la vez — anularlo borra la
    fila (billing/service.py::void_payment) en vez de dejar un estado "cancelado",
    porque un pago mal registrado no es historial útil que conservar; si era la
    última línea de su transacción, la transacción también se borra."""

    __tablename__ = "payments"
    __table_args__ = (
        UniqueConstraint("student_installment_id", name="uq_payment_per_installment"),
    )

    payment_transaction_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("payment_transactions.id"), nullable=False
    )
    student_installment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("student_installments.id"), nullable=False
    )
