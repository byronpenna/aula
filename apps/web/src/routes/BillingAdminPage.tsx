import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiClient } from "../lib/apiClient";
import type {
  AcademicYear,
  EnrolledStudent,
  PaymentPlan,
  PaymentPlanInstallment,
  PaymentPlanWithInstallments,
  Permissions,
} from "../lib/types";
import { EmptyState, ErrorState, ForbiddenState, LoadingState } from "../components/States";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { StatusBadge } from "../components/StatusBadge";
import { formatMoney as money, formatMonth } from "../lib/money";

const inputClass = "focus-ring w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm";
const smallBtn =
  "focus-ring rounded-md border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-100";

// `day` tope en 28 (sección nueva): válido en cualquier mes, incluido febrero —
// evita que "30 de febrero" se desborde a marzo.
function addMonths(startMonth: string, offset: number, day: number): string {
  const [year, month] = startMonth.split("-").map(Number);
  const totalMonths = (month - 1) + offset;
  const resultYear = year + Math.floor(totalMonths / 12);
  const resultMonth = (totalMonths % 12) + 1;
  return `${resultYear}-${String(resultMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Mismo cálculo que billing/service.py::_split_amount, solo para previsualizar
// antes de guardar — el backend es la fuente de verdad una vez se envía.
function previewSplit(total: number, count: number): number[] {
  const cents = Math.round(total * 100);
  const base = Math.floor(cents / count);
  const remainder = cents % count;
  return Array.from({ length: count }, (_, i) => (base + (i < remainder ? 1 : 0)) / 100);
}

// Planes de pago por año académico (sección nueva, permiso billing:manage): el
// monto anual se divide en mensualidades (PaymentPlanInstallment); "quiénes se
// inscriben al año escolar" reutiliza la matrícula ya existente (Enrollment), no
// es un mecanismo de inscripción aparte — ver billing/service.py::list_enrolled_students.
export function BillingAdminPage() {
  const {
    data: permissions,
    isLoading,
    error,
  } = useQuery<Permissions>({
    queryKey: ["me", "permissions"],
    queryFn: async () => (await apiClient.get("/me/permissions")).data,
  });

  const years = useQuery<AcademicYear[]>({
    queryKey: ["academic-years"],
    queryFn: async () => (await apiClient.get("/academic-years")).data,
  });
  const [selectedYearId, setSelectedYearId] = useState("");
  const yearId =
    selectedYearId ||
    years.data?.find((y) => y.status === "active")?.id ||
    years.data?.[0]?.id ||
    "";

  if (isLoading) return <LoadingState label="Cargando…" />;
  if (error) return <ErrorState error={error} />;
  if (!permissions?.permissions.includes("billing:manage")) {
    return (
      <ForbiddenState message="Solo administración escolar o finanzas pueden gestionar planes de pago." />
    );
  }

  return (
    <div className="space-y-4">
      <Breadcrumbs items={[{ label: "Administración", to: "/admin" }, { label: "Pagos" }]} />
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-900">Planes de pago</h1>
        <p className="text-sm text-brand-700">
          Define cuánto paga cada alumno al año, divide el monto en mensualidades, y asígnaselo a
          quienes ya están matriculados en el año escolar. Para registrar cobros, ve a{" "}
          <Link to="/admin/accounting" className="underline hover:text-brand-900">
            Contabilidad
          </Link>
          .
        </p>
      </div>

      {years.isLoading && <LoadingState label="Cargando años…" />}
      {years.error && <ErrorState error={years.error} />}
      {years.data && years.data.length === 0 && (
        <EmptyState
          title="Sin años académicos todavía"
          description="Crea un año académico desde Administración > Academia antes de definir planes de pago."
        />
      )}

      {years.data && years.data.length > 0 && (
        <>
          <div className="max-w-xs">
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Año académico
            </label>
            <select
              value={yearId}
              onChange={(e) => setSelectedYearId(e.target.value)}
              className={inputClass}
            >
              {years.data.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.label}
                </option>
              ))}
            </select>
          </div>

          {yearId && (
            <>
              <PaymentPlansSection yearId={yearId} />
              <EnrolledStudentsSection yearId={yearId} />
            </>
          )}
        </>
      )}
    </div>
  );
}

const planSchema = z.object({
  name: z.string().min(1, "Requerido."),
  total_amount: z
    .string()
    .min(1, "Requerido.")
    .refine((v) => Number(v) > 0, "Debe ser mayor que cero."),
});
type PlanForm = z.infer<typeof planSchema>;

function PaymentPlansSection({ yearId }: { yearId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["academic-years", yearId, "payment-plans"];
  const { data, isLoading, error } = useQuery<PaymentPlanWithInstallments[]>({
    queryKey,
    queryFn: async () => (await apiClient.get(`/academic-years/${yearId}/payment-plans`)).data,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<PlanForm>({ resolver: zodResolver(planSchema) });

  const createMutation = useMutation({
    mutationFn: async (values: PlanForm) =>
      (await apiClient.post(`/academic-years/${yearId}/payment-plans`, values)).data,
    onSuccess: () => {
      invalidate();
      reset();
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ planId, action }: { planId: string; action: "archive" | "activate" }) =>
      (await apiClient.post(`/payment-plans/${planId}/${action}`)).data,
    onSuccess: invalidate,
  });

  return (
    <section className="rounded-xl border border-brand-100 bg-white p-4">
      <h2 className="mb-3 text-base font-semibold text-brand-900">Planes de este año</h2>

      <form
        onSubmit={handleSubmit((values) => createMutation.mutate(values))}
        className="mb-4 grid gap-3 sm:grid-cols-4"
        noValidate
      >
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">Nombre del plan</label>
          <input className={inputClass} placeholder="Ej. 10 cuotas" {...register("name")} />
          {errors.name && <p className="text-xs text-red-600">{errors.name.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Monto total anual
          </label>
          <input
            type="number"
            step="0.01"
            min="0"
            className={inputClass}
            {...register("total_amount")}
          />
          {errors.total_amount && (
            <p className="text-xs text-red-600">{errors.total_amount.message}</p>
          )}
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="focus-ring w-full rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            Crear plan
          </button>
        </div>
      </form>
      {createMutation.isError && <ErrorState error={createMutation.error} />}

      {isLoading && <LoadingState label="Cargando planes…" />}
      {error && <ErrorState error={error} />}
      {data && data.length === 0 && (
        <EmptyState
          title="Sin planes todavía"
          description="Crea el primero arriba: nombre y monto total anual."
        />
      )}
      {data && data.length > 0 && (
        <div className="space-y-3">
          {data.map(({ plan, installments }) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              installments={installments}
              onArchiveToggle={() =>
                statusMutation.mutate({
                  planId: plan.id,
                  action: plan.status === "archived" ? "activate" : "archive",
                })
              }
              onInstallmentsSaved={invalidate}
            />
          ))}
        </div>
      )}
      {statusMutation.isError && <ErrorState error={statusMutation.error} />}
    </section>
  );
}

function PlanCard({
  plan,
  installments,
  onArchiveToggle,
  onInstallmentsSaved,
}: {
  plan: PaymentPlan;
  installments: PaymentPlanInstallment[];
  onArchiveToggle: () => void;
  onInstallmentsSaved: () => void;
}) {
  const [isEditingMonths, setIsEditingMonths] = useState(false);
  const [startMonth, setStartMonth] = useState("");
  const [count, setCount] = useState(10);
  const [dueDay, setDueDay] = useState(5);

  const setInstallmentsMutation = useMutation({
    mutationFn: async (dueDates: string[]) =>
      (await apiClient.post(`/payment-plans/${plan.id}/installments`, { due_dates: dueDates }))
        .data,
    onSuccess: () => {
      onInstallmentsSaved();
      setIsEditingMonths(false);
    },
  });

  const preview = startMonth && count > 0 ? previewSplit(Number(plan.total_amount), count) : [];

  return (
    <div className="rounded-lg border border-brand-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium text-brand-900">{plan.name}</p>
          <p className="text-sm text-slate-500">
            {money(plan.total_amount)} / año ·{" "}
            {installments.length === 0 ? "sin mensualidades" : `${installments.length} cuotas`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className={smallBtn}
            onClick={() => setIsEditingMonths((v) => !v)}
          >
            {isEditingMonths
              ? "Cancelar"
              : installments.length === 0
                ? "Definir meses"
                : "Redefinir meses"}
          </button>
          <button type="button" className={smallBtn} onClick={onArchiveToggle}>
            {plan.status === "archived" ? "Reactivar" : "Archivar"}
          </button>
          <StatusBadge status={plan.status} />
        </div>
      </div>

      {isEditingMonths && (
        <form
          className="mt-3 flex flex-wrap items-end gap-2 rounded-md bg-slate-50 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!startMonth || count < 1 || dueDay < 1) return;
            const dueDates = Array.from({ length: count }, (_, i) =>
              addMonths(startMonth, i, dueDay),
            );
            setInstallmentsMutation.mutate(dueDates);
          }}
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Mes de inicio</label>
            <input
              type="month"
              value={startMonth}
              onChange={(e) => setStartMonth(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Número de cuotas
            </label>
            <input
              type="number"
              min={1}
              max={24}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              className={`${inputClass} w-24`}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Día de pago
            </label>
            <input
              type="number"
              min={1}
              max={28}
              value={dueDay}
              onChange={(e) => setDueDay(Number(e.target.value))}
              className={`${inputClass} w-20`}
              title="Día del mes en que vence cada cuota (máx. 28, válido en todos los meses)"
            />
          </div>
          <button
            type="submit"
            disabled={setInstallmentsMutation.isPending}
            className="focus-ring rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            Guardar meses
          </button>
          {preview.length > 0 && (
            <p className="w-full text-xs text-slate-500">
              Vista previa: {preview.map((a) => money(a)).join(" + ")} = {money(plan.total_amount)}
            </p>
          )}
          {setInstallmentsMutation.isError && (
            <ErrorState error={setInstallmentsMutation.error} />
          )}
        </form>
      )}

      {installments.length > 0 && (
        <ul className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
          {installments.map((installment) => (
            <li key={installment.id} className="rounded-full bg-brand-50 px-2 py-0.5">
              {formatMonth(installment.due_date)}: {money(installment.amount)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EnrolledStudentsSection({ yearId }: { yearId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["academic-years", yearId, "enrolled-students"];
  const { data, isLoading, error } = useQuery<EnrolledStudent[]>({
    queryKey,
    queryFn: async () => (await apiClient.get(`/academic-years/${yearId}/enrolled-students`)).data,
  });

  const plans = useQuery<PaymentPlanWithInstallments[]>({
    queryKey: ["academic-years", yearId, "payment-plans"],
    queryFn: async () => (await apiClient.get(`/academic-years/${yearId}/payment-plans`)).data,
  });
  const activePlans = plans.data?.filter(({ plan }) => plan.status === "active") ?? [];

  const [assigningStudentId, setAssigningStudentId] = useState<string | null>(null);
  const [selectedPlanId, setSelectedPlanId] = useState("");

  const assignMutation = useMutation({
    mutationFn: async ({ studentId, planId }: { studentId: string; planId: string }) =>
      (
        await apiClient.post(`/academic-years/${yearId}/students/${studentId}/payment-plan`, {
          payment_plan_id: planId,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      setAssigningStudentId(null);
      setSelectedPlanId("");
    },
  });

  const studentLabel = (student: EnrolledStudent) =>
    student.display_name
      ? `${student.display_name} (${student.student_number})`
      : student.student_number;

  return (
    <section className="rounded-xl border border-brand-100 bg-white p-4">
      <h2 className="mb-3 text-base font-semibold text-brand-900">
        Alumnos matriculados este año
      </h2>

      {isLoading && <LoadingState label="Cargando alumnos…" />}
      {error && <ErrorState error={error} />}
      {data && data.length === 0 && (
        <EmptyState
          title="Sin alumnos matriculados"
          description="Matricula alumnos en este año desde Administración > Academia > Inscripciones."
        />
      )}
      {data && data.length > 0 && (
        <ul className="divide-y divide-brand-50">
          {data.map((student) => (
            <li key={student.id} className="py-2.5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-medium text-brand-900">{studentLabel(student)}</p>
                  <p className="text-sm text-slate-500">
                    {student.has_payment_plan ? "Plan asignado" : "Sin plan asignado"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {assigningStudentId === student.id ? (
                    <form
                      className="flex items-center gap-2"
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (selectedPlanId) {
                          assignMutation.mutate({ studentId: student.id, planId: selectedPlanId });
                        }
                      }}
                    >
                      <select
                        value={selectedPlanId}
                        onChange={(e) => setSelectedPlanId(e.target.value)}
                        className={inputClass}
                      >
                        <option value="">Selecciona un plan…</option>
                        {activePlans.map(({ plan }) => (
                          <option key={plan.id} value={plan.id}>
                            {plan.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="submit"
                        disabled={!selectedPlanId || assignMutation.isPending}
                        className="focus-ring rounded-md bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                      >
                        Asignar
                      </button>
                      <button
                        type="button"
                        className={smallBtn}
                        onClick={() => setAssigningStudentId(null)}
                      >
                        Cancelar
                      </button>
                    </form>
                  ) : (
                    <button
                      type="button"
                      className={smallBtn}
                      onClick={() => setAssigningStudentId(student.id)}
                    >
                      {student.has_payment_plan ? "Cambiar plan" : "Asignar plan"}
                    </button>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {assignMutation.isError && <ErrorState error={assignMutation.error} />}
    </section>
  );
}
