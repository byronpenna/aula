"""Reglas de negocio de planes de pago (sección nueva, permiso billing:manage).

Regla universal (sección 6): toda referencia a una entidad padre (año académico,
plan, alumno) se valida contra el `school_id` efectivo de la membresía actual.
"""

from __future__ import annotations

import uuid
from datetime import date
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy.orm import Session

from app.core.deps import CurrentMembership
from app.core.errors import ConflictError, NotFoundError, UnprocessableError
from app.modules.academics import repository as academics_repo
from app.modules.academics import service as academics_service
from app.modules.billing import repository as billing_repo
from app.modules.billing.models import (
    Payment,
    PaymentPlan,
    PaymentPlanInstallment,
    PaymentTransaction,
    StudentInstallment,
    StudentPaymentPlan,
)
from app.modules.identity import repository as identity_repo
from app.modules.identity import service as identity_service


def _require_academic_year(db: Session, school_id: uuid.UUID, academic_year_id: uuid.UUID):
    year = academics_repo.get_academic_year(db, school_id, academic_year_id)
    if year is None:
        raise NotFoundError("El año académico indicado no existe en este colegio.")
    return year


def _require_plan(db: Session, school_id: uuid.UUID, plan_id: uuid.UUID) -> PaymentPlan:
    plan = billing_repo.get_payment_plan(db, school_id, plan_id)
    if plan is None:
        raise NotFoundError("El plan de pago indicado no existe en este colegio.")
    return plan


def _clean_name(name: str) -> str:
    return " ".join(name.strip().split())


def _split_amount(total: Decimal, count: int) -> list[Decimal]:
    """Divide `total` en `count` mensualidades de 2 decimales que suman
    exactamente `total`: todas reciben la misma base redondeada a centavos, y el
    resto de centavos (siempre menor que `count`) se reparte de a uno extra en
    las primeras mensualidades, en vez de concentrar el ajuste en la última."""
    cents_total = int((total * 100).to_integral_value(rounding=ROUND_HALF_UP))
    base, remainder = divmod(cents_total, count)
    return [Decimal(base + (1 if i < remainder else 0)) / Decimal(100) for i in range(count)]


def create_payment_plan(
    db: Session,
    current: CurrentMembership,
    academic_year_id: uuid.UUID,
    name: str,
    total_amount: Decimal,
    request_id: str | None,
) -> PaymentPlan:
    _require_academic_year(db, current.school_id, academic_year_id)
    clean_name = _clean_name(name)
    if not clean_name:
        raise UnprocessableError("El nombre no puede estar vacío.")
    if total_amount <= 0:
        raise UnprocessableError("El monto total debe ser mayor que cero.")

    plan = PaymentPlan(
        school_id=current.school_id,
        academic_year_id=academic_year_id,
        name=clean_name,
        total_amount=total_amount,
    )
    db.add(plan)
    identity_service.record_audit_event(
        db,
        school_id=current.school_id,
        actor_id=current.membership.user_id,
        action="payment_plan.create",
        target_type="payment_plan",
        target_id=str(plan.id),
        request_id=request_id,
    )
    db.commit()
    db.refresh(plan)
    return plan


def update_payment_plan(
    db: Session,
    current: CurrentMembership,
    plan_id: uuid.UUID,
    name: str | None,
    total_amount: Decimal | None,
    request_id: str | None,
) -> PaymentPlan:
    plan = _require_plan(db, current.school_id, plan_id)
    if name is not None:
        clean_name = _clean_name(name)
        if not clean_name:
            raise UnprocessableError("El nombre no puede estar vacío.")
        plan.name = clean_name
    if total_amount is not None:
        if total_amount <= 0:
            raise UnprocessableError("El monto total debe ser mayor que cero.")
        plan.total_amount = total_amount
        # Si ya tiene mensualidades definidas, se recalculan con el nuevo total
        # (mismas fechas, montos nuevos): el plan nunca queda con un total que no
        # coincide con la suma de sus mensualidades.
        installments = billing_repo.list_plan_installments(db, plan.id)
        if installments:
            amounts = _split_amount(total_amount, len(installments))
            for installment, amount in zip(installments, amounts):
                installment.amount = amount

    identity_service.record_audit_event(
        db,
        school_id=current.school_id,
        actor_id=current.membership.user_id,
        action="payment_plan.update",
        target_type="payment_plan",
        target_id=str(plan.id),
        request_id=request_id,
    )
    db.commit()
    db.refresh(plan)
    return plan


def set_plan_status(
    db: Session, current: CurrentMembership, plan_id: uuid.UUID, status: str, request_id: str | None
) -> PaymentPlan:
    plan = _require_plan(db, current.school_id, plan_id)
    if plan.status != status:
        plan.status = status
        identity_service.record_audit_event(
            db,
            school_id=current.school_id,
            actor_id=current.membership.user_id,
            action=f"payment_plan.{status}",
            target_type="payment_plan",
            target_id=str(plan.id),
            request_id=request_id,
        )
        db.commit()
        db.refresh(plan)
    return plan


def list_payment_plans_with_installments(
    db: Session, current: CurrentMembership, academic_year_id: uuid.UUID
) -> list[tuple[PaymentPlan, list[PaymentPlanInstallment]]]:
    _require_academic_year(db, current.school_id, academic_year_id)
    plans = billing_repo.list_payment_plans(db, current.school_id, academic_year_id)
    return [(plan, billing_repo.list_plan_installments(db, plan.id)) for plan in plans]


def set_plan_installments(
    db: Session,
    current: CurrentMembership,
    plan_id: uuid.UUID,
    due_dates: list[date],
    request_id: str | None,
) -> list[PaymentPlanInstallment]:
    """Elegir los meses y ver cómo se divide el pago (sección nueva): reemplaza el
    set completo de mensualidades del plan. Nunca afecta retroactivamente a
    alumnos ya asignados — sus StudentInstallment son una copia aparte."""
    plan = _require_plan(db, current.school_id, plan_id)
    if not due_dates:
        raise UnprocessableError("Elige al menos un mes para dividir el pago.")
    unique_dates = sorted(set(due_dates))
    if len(unique_dates) != len(due_dates):
        raise UnprocessableError("Hay fechas repetidas entre los meses elegidos.")

    for existing in billing_repo.list_plan_installments(db, plan.id):
        db.delete(existing)
    db.flush()

    amounts = _split_amount(plan.total_amount, len(unique_dates))
    installments = [
        PaymentPlanInstallment(
            school_id=current.school_id, payment_plan_id=plan.id, due_date=due_date, amount=amount
        )
        for due_date, amount in zip(unique_dates, amounts)
    ]
    db.add_all(installments)
    identity_service.record_audit_event(
        db,
        school_id=current.school_id,
        actor_id=current.membership.user_id,
        action="payment_plan.set_installments",
        target_type="payment_plan",
        target_id=str(plan.id),
        request_id=request_id,
    )
    db.commit()
    for installment in installments:
        db.refresh(installment)
    return installments


def list_enrolled_students(
    db: Session, current: CurrentMembership, academic_year_id: uuid.UUID
) -> list[dict]:
    """Quiénes se inscriben al año escolar (sección nueva): reutiliza la matrícula
    ya existente (Enrollment), deduplicada por alumno — no es un mecanismo de
    inscripción aparte. `has_payment_plan` le dice al admin a quién le falta
    asignar un plan."""
    _require_academic_year(db, current.school_id, academic_year_id)
    enrollments = academics_repo.list_enrollments_for_year(db, current.school_id, academic_year_id)
    seen: set[uuid.UUID] = set()
    result = []
    for enrollment in enrollments:
        if enrollment.student_id in seen:
            continue
        seen.add(enrollment.student_id)
        profile = identity_repo.get_student_profile(db, enrollment.student_id)
        if profile is None:
            continue
        display_name = (
            identity_repo.get_user(db, profile.user_id).display_name if profile.user_id else None
        )
        has_plan = (
            billing_repo.get_active_student_payment_plan(
                db, current.school_id, enrollment.student_id, academic_year_id
            )
            is not None
        )
        result.append(
            {
                "id": profile.id,
                "student_number": profile.student_number,
                "display_name": display_name,
                "section_id": enrollment.section_id,
                "has_payment_plan": has_plan,
            }
        )
    return result


def assign_plan_to_student(
    db: Session,
    current: CurrentMembership,
    academic_year_id: uuid.UUID,
    student_id: uuid.UUID,
    payment_plan_id: uuid.UUID,
    request_id: str | None,
) -> tuple[StudentPaymentPlan, PaymentPlan, list[StudentInstallment]]:
    _require_academic_year(db, current.school_id, academic_year_id)
    plan = _require_plan(db, current.school_id, payment_plan_id)
    if plan.academic_year_id != academic_year_id:
        raise UnprocessableError("El plan indicado no pertenece a este año académico.")
    if plan.status == "archived":
        raise UnprocessableError("Este plan está archivado; no admite asignaciones nuevas.")

    enrollment = academics_repo.get_enrollment_for_student_year(
        db, current.school_id, student_id, academic_year_id
    )
    if enrollment is None:
        raise UnprocessableError("El alumno no está matriculado en este año académico.")

    plan_installments = billing_repo.list_plan_installments(db, plan.id)
    if not plan_installments:
        raise UnprocessableError(
            "Este plan no tiene mensualidades configuradas; define los meses antes de asignarlo."
        )

    existing = billing_repo.get_active_student_payment_plan(
        db, current.school_id, student_id, academic_year_id
    )
    if existing is not None:
        existing.status = "cancelled"

    assignment = StudentPaymentPlan(
        school_id=current.school_id,
        student_id=student_id,
        academic_year_id=academic_year_id,
        enrollment_id=enrollment.id,
        payment_plan_id=plan.id,
    )
    db.add(assignment)
    db.flush()

    student_installments = [
        StudentInstallment(
            school_id=current.school_id,
            student_payment_plan_id=assignment.id,
            due_date=installment.due_date,
            amount=installment.amount,
        )
        for installment in plan_installments
    ]
    db.add_all(student_installments)

    identity_service.record_audit_event(
        db,
        school_id=current.school_id,
        actor_id=current.membership.user_id,
        action="student_payment_plan.assign",
        target_type="student_payment_plan",
        target_id=str(assignment.id),
        request_id=request_id,
    )
    db.commit()
    db.refresh(assignment)
    for student_installment in student_installments:
        db.refresh(student_installment)
    return assignment, plan, student_installments


def get_student_payment_plan(
    db: Session, current: CurrentMembership, academic_year_id: uuid.UUID, student_id: uuid.UUID
) -> tuple[StudentPaymentPlan, PaymentPlan, list[StudentInstallment]] | None:
    _require_academic_year(db, current.school_id, academic_year_id)
    assignment = billing_repo.get_active_student_payment_plan(
        db, current.school_id, student_id, academic_year_id
    )
    if assignment is None:
        return None
    plan = billing_repo.get_payment_plan(db, current.school_id, assignment.payment_plan_id)
    installments = billing_repo.list_student_installments(db, assignment.id)
    return assignment, plan, installments


def effective_status(installment: StudentInstallment) -> str:
    """"paid" | "pending" | "overdue" (sección nueva, nunca guardado): una
    mensualidad "pending" cuya fecha ya pasó se reporta "en mora" al leer, sin
    necesidad de un job que la actualice — se recalcula en cada lectura contra la
    fecha de hoy."""
    if installment.status == "paid":
        return "paid"
    if installment.due_date < date.today():
        return "overdue"
    return "pending"


def get_student_payment_status(
    db: Session, current: CurrentMembership, user_id: uuid.UUID, student_id: uuid.UUID
) -> tuple[StudentPaymentPlan, PaymentPlan, list[StudentInstallment]] | None:
    """Ficha del alumno (sección nueva): docente que comparte un curso con él, o
    admin/coordinación — ver academics_service.require_student_billing_access, más
    angosto que require_student_access (nunca el propio alumno ni su tutor aquí).
    Usa el año académico activo del colegio; si no hay uno, o el alumno no tiene
    plan asignado ahí, no es un error — simplemente no hay nada que mostrar."""
    academics_service.require_student_billing_access(db, current, user_id, student_id)
    years = academics_repo.list_academic_years(db, current.school_id)
    active_year = next((y for y in years if y.status == "active"), None)
    if active_year is None:
        return None
    assignment = billing_repo.get_active_student_payment_plan(
        db, current.school_id, student_id, active_year.id
    )
    if assignment is None:
        return None
    plan = billing_repo.get_payment_plan(db, current.school_id, assignment.payment_plan_id)
    installments = billing_repo.list_student_installments(db, assignment.id)
    return assignment, plan, installments


VALID_PAYMENT_METHODS = {"cash", "card"}


def record_payment_transaction(
    db: Session,
    current: CurrentMembership,
    user_id: uuid.UUID,
    installment_ids: list[uuid.UUID],
    method: str,
    authorization_number: str | None,
    amount_tendered: Decimal | None,
    paid_at: date | None,
    request_id: str | None,
) -> tuple[PaymentTransaction, list[StudentInstallment]]:
    """Contabilidad (sección nueva, billing:manage): un cobro puede cubrir varias
    mensualidades del MISMO alumno a la vez — registrar un pago es lo único que
    marca una mensualidad como pagada, nunca un simple toggle de estado, porque
    efectivo/tarjeta, el vuelto y el número de autorización son datos que el
    colegio necesita conservar."""
    if not installment_ids:
        raise UnprocessableError("Selecciona al menos una mensualidad para cobrar.")
    if method not in VALID_PAYMENT_METHODS:
        raise UnprocessableError(
            f"Método de pago no válido: {method}.", details={"allowed": sorted(VALID_PAYMENT_METHODS)}
        )

    installments = []
    student_ids = set()
    for installment_id in installment_ids:
        installment = billing_repo.get_student_installment(db, current.school_id, installment_id)
        if installment is None:
            raise NotFoundError(f"La mensualidad {installment_id} no existe en este colegio.")
        if installment.status == "paid":
            raise ConflictError(
                f"La mensualidad con vencimiento {installment.due_date} ya está pagada."
            )
        plan_assignment = db.get(StudentPaymentPlan, installment.student_payment_plan_id)
        student_ids.add(plan_assignment.student_id)
        installments.append(installment)
    if len(student_ids) > 1:
        raise UnprocessableError("Todas las mensualidades de un mismo cobro deben ser del mismo alumno.")

    amount_total = sum((i.amount for i in installments), Decimal("0"))

    clean_authorization = (authorization_number or "").strip() or None
    change_given = None
    if method == "card":
        if not clean_authorization:
            raise UnprocessableError("El pago con tarjeta requiere un número de autorización.")
        amount_tendered = None
    else:  # cash
        clean_authorization = None  # nunca se guarda un número de autorización en efectivo
        if amount_tendered is None:
            raise UnprocessableError("Indica con cuánto pagó el alumno para calcular el vuelto.")
        if amount_tendered < amount_total:
            raise UnprocessableError(
                f"El monto entregado ({amount_tendered}) es menor al total a cobrar ({amount_total})."
            )
        change_given = amount_tendered - amount_total

    transaction = PaymentTransaction(
        school_id=current.school_id,
        method=method,
        authorization_number=clean_authorization,
        amount_tendered=amount_tendered,
        amount_total=amount_total,
        change_given=change_given,
        paid_at=paid_at or date.today(),
        recorded_by_user_id=user_id,
    )
    db.add(transaction)
    db.flush()

    db.add_all(
        [
            Payment(
                school_id=current.school_id,
                payment_transaction_id=transaction.id,
                student_installment_id=installment.id,
            )
            for installment in installments
        ]
    )
    for installment in installments:
        installment.status = "paid"

    identity_service.record_audit_event(
        db,
        school_id=current.school_id,
        actor_id=current.membership.user_id,
        action="payment_transaction.record",
        target_type="payment_transaction",
        target_id=str(transaction.id),
        request_id=request_id,
    )
    db.commit()
    db.refresh(transaction)
    for installment in installments:
        db.refresh(installment)
    return transaction, installments


def void_payment(
    db: Session,
    current: CurrentMembership,
    installment_id: uuid.UUID,
    request_id: str | None,
) -> StudentInstallment:
    """Anular un pago mal registrado borra la línea de Payment (sección nueva): no
    es historial de negocio que valga la pena conservar como "cancelado". Si era
    la última línea de su PaymentTransaction, la transacción también se borra —
    una transacción sin mensualidades asociadas no tiene sentido como registro."""
    installment = billing_repo.get_student_installment(db, current.school_id, installment_id)
    if installment is None:
        raise NotFoundError("La mensualidad indicada no existe en este colegio.")
    payment = billing_repo.get_payment_for_installment(db, current.school_id, installment.id)
    if payment is None:
        raise NotFoundError("Esta mensualidad no tiene un pago registrado.")

    transaction_id = payment.payment_transaction_id
    db.delete(payment)
    installment.status = "pending"
    db.flush()
    if billing_repo.count_payments_for_transaction(db, transaction_id) == 0:
        transaction = billing_repo.get_payment_transaction(db, current.school_id, transaction_id)
        if transaction is not None:
            db.delete(transaction)

    identity_service.record_audit_event(
        db,
        school_id=current.school_id,
        actor_id=current.membership.user_id,
        action="payment.void",
        target_type="student_installment",
        target_id=str(installment.id),
        request_id=request_id,
    )
    db.commit()
    db.refresh(installment)
    return installment
