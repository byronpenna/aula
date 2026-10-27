import { Fragment, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/apiClient";
import type {
  AcademicYear,
  EnrolledStudent,
  GradeLevel,
  Permissions,
  Section,
  StudentPaymentPlan,
} from "../lib/types";
import { EmptyState, ErrorState, ForbiddenState, LoadingState } from "../components/States";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { formatMoney as money, formatMonth } from "../lib/money";
import { EFFECTIVE_STATUS_CLASS, EFFECTIVE_STATUS_LABEL, PAYMENT_METHOD_LABEL } from "../lib/billing";

const inputClass = "focus-ring w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm";
const smallBtn =
  "focus-ring rounded-md border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-100";
const th = "px-2 py-1.5 text-left text-xs font-medium text-brand-700";
const td = "px-2 py-1.5 text-sm text-slate-700";

// Contabilidad (sección nueva, permiso billing:manage): tabla de alumnos
// matriculados en un año, filtrable por grado/sección, con un cobro que puede
// cubrir varias mensualidades del mismo alumno a la vez — ver
// billing/service.py::record_payment_transaction. Esta página es la única parte
// administrativa que registra/anula pagos; "Planes de pago" (BillingAdminPage.tsx)
// solo define los planes, y la ficha del alumno (StudentDetailPage.tsx) es de
// solo lectura a propósito.
export function AccountingPage() {
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
  const grades = useQuery<GradeLevel[]>({
    queryKey: ["grade-levels"],
    queryFn: async () => (await apiClient.get("/grade-levels")).data,
  });
  const sections = useQuery<Section[]>({
    queryKey: ["sections"],
    queryFn: async () => (await apiClient.get("/sections")).data,
  });

  const [selectedYearId, setSelectedYearId] = useState("");
  const yearId =
    selectedYearId ||
    years.data?.find((y) => y.status === "active")?.id ||
    years.data?.[0]?.id ||
    "";
  const [gradeId, setGradeId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);

  const students = useQuery<EnrolledStudent[]>({
    queryKey: ["academic-years", yearId, "enrolled-students"],
    queryFn: async () => (await apiClient.get(`/academic-years/${yearId}/enrolled-students`)).data,
    enabled: Boolean(yearId),
  });

  if (isLoading) return <LoadingState label="Cargando…" />;
  if (error) return <ErrorState error={error} />;
  if (!permissions?.permissions.includes("billing:manage")) {
    return (
      <ForbiddenState message="Solo administración escolar o finanzas pueden ver Contabilidad." />
    );
  }

  const sectionsForYear = sections.data?.filter((s) => s.academic_year_id === yearId) ?? [];
  const sectionOptions = sectionsForYear.filter((s) => !gradeId || s.grade_level_id === gradeId);
  const sectionById = (id: string) => sections.data?.find((s) => s.id === id);
  const gradeById = (id: string) => grades.data?.find((g) => g.id === id);

  const filteredStudents = (students.data ?? []).filter((student) => {
    if (sectionId) return student.section_id === sectionId;
    if (gradeId) {
      const section = sectionById(student.section_id);
      return section?.grade_level_id === gradeId;
    }
    return true;
  });

  const studentLabel = (student: EnrolledStudent) => student.display_name ?? "Sin nombre registrado";

  return (
    <div className="space-y-4">
      <Breadcrumbs items={[{ label: "Administración", to: "/admin" }, { label: "Contabilidad" }]} />
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-900">Contabilidad</h1>
        <p className="text-sm text-brand-700">
          Cobra una o varias mensualidades a la vez, en efectivo (con vuelto) o con tarjeta.
        </p>
      </div>

      {years.data && years.data.length === 0 ? (
        <EmptyState
          title="Sin años académicos todavía"
          description="Crea un año académico desde Administración > Academia."
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-3 sm:max-w-xl">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Año académico</label>
            <select
              value={yearId}
              onChange={(e) => {
                setSelectedYearId(e.target.value);
                setSectionId("");
              }}
              className={inputClass}
            >
              {years.data?.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Grado</label>
            <select
              value={gradeId}
              onChange={(e) => {
                setGradeId(e.target.value);
                setSectionId("");
              }}
              className={inputClass}
            >
              <option value="">Todos</option>
              {grades.data?.map((grade) => (
                <option key={grade.id} value={grade.id}>
                  {grade.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Sección</label>
            <select
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              className={inputClass}
            >
              <option value="">Todas</option>
              {sectionOptions.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {students.isLoading && <LoadingState label="Cargando alumnos…" />}
      {students.error && <ErrorState error={students.error} />}
      {students.data && filteredStudents.length === 0 && (
        <EmptyState
          title="Sin alumnos"
          description="No hay alumnos matriculados que coincidan con los filtros elegidos."
        />
      )}
      {filteredStudents.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-brand-100 bg-white">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-brand-100">
                <th className={th}>Alumno</th>
                <th className={th}>Matrícula</th>
                <th className={th}>Grado</th>
                <th className={th}>Sección</th>
                <th className={th}>Plan</th>
                <th className={th}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student) => {
                const section = sectionById(student.section_id);
                const grade = section ? gradeById(section.grade_level_id) : undefined;
                const isExpanded = expandedStudentId === student.id;
                return (
                  <Fragment key={student.id}>
                    <tr className="border-b border-slate-100">
                      <td className={td}>{studentLabel(student)}</td>
                      <td className={td}>{student.student_number}</td>
                      <td className={td}>{grade?.name ?? "—"}</td>
                      <td className={td}>{section?.name ?? "—"}</td>
                      <td className={td}>{student.has_payment_plan ? "Asignado" : "Sin plan"}</td>
                      <td className={td}>
                        {student.has_payment_plan ? (
                          <button
                            type="button"
                            className={smallBtn}
                            onClick={() => setExpandedStudentId(isExpanded ? null : student.id)}
                          >
                            {isExpanded ? "Ocultar" : "Cobrar"}
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400">Asigna un plan primero</span>
                        )}
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr className="border-b border-slate-100 bg-slate-50/60">
                        <td colSpan={6} className="p-3">
                          <StudentPaymentPanel yearId={yearId} studentId={student.id} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Panel de cobro de un alumno puntual: selecciona una o varias mensualidades
// pendientes y las cobra en una sola transacción (POST /payment-transactions).
// En efectivo pide el monto recibido para calcular el vuelto; con tarjeta pide el
// número de autorización — ambos validados también en el backend.
function StudentPaymentPanel({ yearId, studentId }: { yearId: string; studentId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["academic-years", yearId, "students", studentId, "payment-plan"];
  const { data, isLoading, error } = useQuery<StudentPaymentPlan | null>({
    queryKey,
    queryFn: async () =>
      (await apiClient.get(`/academic-years/${yearId}/students/${studentId}/payment-plan`)).data,
  });

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [method, setMethod] = useState<"cash" | "card">("cash");
  const [authorizationNumber, setAuthorizationNumber] = useState("");
  const [amountTendered, setAmountTendered] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const payMutation = useMutation({
    mutationFn: async () =>
      (
        await apiClient.post("/payment-transactions", {
          student_installment_ids: selectedIds,
          method,
          authorization_number: method === "card" ? authorizationNumber : undefined,
          amount_tendered: method === "cash" ? amountTendered : undefined,
        })
      ).data,
    onSuccess: () => {
      invalidate();
      setSelectedIds([]);
      setAuthorizationNumber("");
      setAmountTendered("");
    },
  });

  const voidMutation = useMutation({
    mutationFn: async (installmentId: string) =>
      (await apiClient.delete(`/student-installments/${installmentId}/payments`)).data,
    onSuccess: invalidate,
  });

  function toggle(installmentId: string) {
    setSelectedIds((ids) =>
      ids.includes(installmentId) ? ids.filter((id) => id !== installmentId) : [...ids, installmentId],
    );
  }

  if (isLoading) return <LoadingState label="Cargando mensualidades…" />;
  if (error) return <ErrorState error={error} />;
  if (!data) {
    return <p className="text-sm text-slate-500">Este alumno no tiene un plan activo en este año.</p>;
  }

  const unpaid = data.installments.filter((i) => i.effective_status !== "paid");
  const selectedTotal = unpaid
    .filter((i) => selectedIds.includes(i.id))
    .reduce((sum, i) => sum + Number(i.amount), 0);
  const tenderedNumber = Number(amountTendered || 0);
  const change = amountTendered ? tenderedNumber - selectedTotal : null;
  const canSubmit =
    selectedIds.length > 0 &&
    (method === "card" ? authorizationNumber.trim().length > 0 : Boolean(amountTendered) && tenderedNumber >= selectedTotal);

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-slate-600">Plan: {data.payment_plan_name}</p>
      <ul className="space-y-1">
        {data.installments.map((installment) => (
          <li
            key={installment.id}
            className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white p-2 text-sm"
          >
            {installment.effective_status !== "paid" ? (
              <input
                type="checkbox"
                checked={selectedIds.includes(installment.id)}
                onChange={() => toggle(installment.id)}
              />
            ) : (
              <span className="inline-block w-4" aria-hidden="true" />
            )}
            <span className="min-w-20">{formatMonth(installment.due_date)}</span>
            <span className="text-slate-500">{money(installment.amount)}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs ring-1 ring-inset ${EFFECTIVE_STATUS_CLASS[installment.effective_status]}`}
            >
              {EFFECTIVE_STATUS_LABEL[installment.effective_status]}
            </span>
            {installment.payment && (
              <>
                <span className="text-xs text-slate-400">
                  {PAYMENT_METHOD_LABEL[installment.payment.method]}
                  {installment.payment.authorization_number &&
                    ` · Aut. ${installment.payment.authorization_number}`}
                </span>
                <button
                  type="button"
                  className={`${smallBtn} ml-auto border-red-200 text-red-700 hover:bg-red-50`}
                  onClick={() => voidMutation.mutate(installment.id)}
                  disabled={voidMutation.isPending}
                >
                  Anular pago
                </button>
              </>
            )}
          </li>
        ))}
      </ul>

      {unpaid.length > 0 && (
        <form
          className="flex flex-wrap items-end gap-3 rounded-md bg-white p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) payMutation.mutate();
          }}
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Método</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as "cash" | "card")}
              className={inputClass}
            >
              <option value="cash">Efectivo</option>
              <option value="card">Tarjeta</option>
            </select>
          </div>
          {method === "card" ? (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Número de autorización
              </label>
              <input
                value={authorizationNumber}
                onChange={(e) => setAuthorizationNumber(e.target.value)}
                className={inputClass}
              />
            </div>
          ) : (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Monto recibido</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={amountTendered}
                onChange={(e) => setAmountTendered(e.target.value)}
                className={inputClass}
              />
            </div>
          )}
          <div className="text-sm text-slate-600">
            <p>
              Total seleccionado: <strong>{money(selectedTotal)}</strong>
            </p>
            {method === "cash" && amountTendered && (
              <p className={change !== null && change < 0 ? "font-medium text-red-600" : ""}>
                {change !== null && change < 0
                  ? "Monto insuficiente"
                  : `Vuelto: ${money(change ?? 0)}`}
              </p>
            )}
          </div>
          <button
            type="submit"
            disabled={!canSubmit || payMutation.isPending}
            className="focus-ring rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            Cobrar{selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}
          </button>
          {payMutation.isError && <ErrorState error={payMutation.error} />}
        </form>
      )}
      {voidMutation.isError && <ErrorState error={voidMutation.error} />}
    </div>
  );
}
