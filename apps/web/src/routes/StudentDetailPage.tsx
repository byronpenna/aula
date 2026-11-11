import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiClient, ApiError } from "../lib/apiClient";
import type { Course, GuardianLink, Permissions, StudentDetail, StudentPaymentPlan } from "../lib/types";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { StatusBadge } from "../components/StatusBadge";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { StudentAvatar } from "../components/StudentAvatar";
import { WhatsAppIcon } from "../components/icons";
import { formatMoney, formatMonth } from "../lib/money";
import { EFFECTIVE_STATUS_CLASS, EFFECTIVE_STATUS_LABEL, PAYMENT_METHOD_LABEL } from "../lib/billing";

// wa.me solo acepta dígitos (con código de país, sin "+" ni espacios/guiones);
// el teléfono se guarda tal cual lo ingresó quien lo editó (ver
// identity/models.py::User.phone), así que se limpia recién aquí al armar el
// enlace, nunca al guardarlo.
function toWhatsAppLink(phone: string): string {
  return `https://wa.me/${phone.replace(/\D/g, "")}`;
}

// Ficha de alumno: mismo guard que sus matrículas/entregas (sección 6, ver
// academics/service.py::require_student_access) — admin/coordinación, el docente
// que comparte al menos un curso con él, su tutor vinculado, o el propio alumno.
// Se llega aquí haciendo clic en un alumno desde "Estudiantes inscritos"
// (CourseDetailPage.tsx), de ahí que no necesite su propio chequeo de rol en el
// frontend: si el backend no autoriza, ErrorState ya muestra el 404/403 real.
export function StudentDetailPage() {
  const { studentId } = useParams<{ studentId: string }>();

  const {
    data: student,
    isLoading,
    error,
  } = useQuery<StudentDetail>({
    queryKey: ["students", studentId],
    queryFn: async () => (await apiClient.get(`/students/${studentId}`)).data,
    enabled: Boolean(studentId),
  });

  const courses = useQuery<Course[]>({
    queryKey: ["students", studentId, "courses"],
    queryFn: async () => (await apiClient.get(`/students/${studentId}/courses`)).data,
    enabled: Boolean(studentId),
  });

  // La foto solo se intenta descargar para quien realmente puede verla (ver el
  // mismo comentario en CourseDetailPage.tsx::CourseStudentsSection).
  const { data: permissions } = useQuery<Permissions>({
    queryKey: ["me", "permissions"],
    queryFn: async () => (await apiClient.get("/me/permissions")).data,
  });
  const canViewPhoto = permissions?.permissions.includes("enrollment:manage") ?? false;

  if (isLoading) return <LoadingState label="Cargando ficha del alumno…" />;
  if (error) return <ErrorState error={error} />;
  if (!student) return null;

  const name = student.display_name ?? "Sin nombre registrado";

  return (
    <div className="space-y-4">
      <Breadcrumbs items={[{ label: "Cursos", to: "/courses" }, { label: name }]} />

      <div className="rounded-xl border border-brand-100 bg-white p-4">
        <div className="flex items-center gap-3">
          <StudentAvatar
            photoFileId={canViewPhoto ? student.photo_file_id : null}
            name={name}
            size="h-12 w-12"
          />
          <div className="min-w-0">
            <h1 className="truncate font-display text-xl font-semibold text-brand-900">{name}</h1>
            <p className="text-sm text-slate-500">Matrícula {student.student_number}</p>
          </div>
        </div>
        <div className="mt-4 border-t border-brand-50 pt-3 text-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-brand-700">Correo</p>
          <p className="text-slate-700">{student.email ?? "Sin cuenta de usuario todavía"}</p>
        </div>
      </div>

      <div>
        <h2 className="mb-3 text-base font-semibold text-brand-900">
          Cursos en los que está inscrito
        </h2>
        {courses.isLoading && <LoadingState label="Cargando cursos…" />}
        {courses.error && <ErrorState error={courses.error} />}
        {courses.data && courses.data.length === 0 && (
          <EmptyState
            title="Sin cursos todavía"
            description="Este alumno no está matriculado en ningún curso activo."
          />
        )}
        {courses.data && courses.data.length > 0 && (
          <ul className="grid gap-3 sm:grid-cols-2">
            {courses.data.map((course) => {
              const courseName = course.name ?? `Curso ${course.id.slice(0, 8)}`;
              return (
                <li key={course.id}>
                  <Link
                    to={`/courses/${course.id}`}
                    className="focus-ring block rounded-xl border border-brand-100 bg-white p-4 shadow-sm transition hover:border-brand-300 hover:shadow-md"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate font-display font-medium text-brand-900">
                        {courseName}
                      </p>
                      <StatusBadge status={course.status} />
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {studentId && <StudentGuardiansSection studentId={studentId} />}
      {studentId && <StudentPaymentSection studentId={studentId} />}
    </div>
  );
}

// Tutores del alumno (sección nueva, SOLO LECTURA): mismo guard amplio que el
// resto de la ficha —require_student_access, ver
// identity/service.py::list_guardian_links— así que cualquiera que ya puede
// ver esta página también puede ver aquí quiénes son sus tutores. Administrar
// el vínculo (agregar/quitar tutor) sigue viviendo en Administración > Alumnos
// (StudentsAdminPage.tsx), que exige guardian_link:manage; aquí es solo para
// poder contactarlo, de ahí el botón de WhatsApp en vez de un formulario.
function StudentGuardiansSection({ studentId }: { studentId: string }) {
  const { data, isLoading, error } = useQuery<GuardianLink[]>({
    queryKey: ["students", studentId, "guardians"],
    queryFn: async () => (await apiClient.get(`/students/${studentId}/guardians`)).data,
  });

  if (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 403)) return null;
    return <ErrorState error={error} />;
  }
  if (isLoading) return <LoadingState label="Cargando tutores…" />;
  const guardians = (data ?? []).filter((g) => g.status === "active");
  if (guardians.length === 0) return null;

  return (
    <div className="rounded-xl border border-brand-100 bg-white p-4">
      <h2 className="mb-3 text-base font-semibold text-brand-900">Tutores</h2>
      <ul className="space-y-2">
        {guardians.map((guardian) => (
          <li
            key={guardian.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-50 p-2.5"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium text-brand-900">
                {guardian.guardian_display_name ?? "Usuario eliminado"}
              </p>
              <p className="text-xs text-slate-500">
                {guardian.relationship_label}
                {guardian.guardian_phone && ` · ${guardian.guardian_phone}`}
              </p>
            </div>
            {guardian.guardian_phone ? (
              <a
                href={toWhatsAppLink(guardian.guardian_phone)}
                target="_blank"
                rel="noreferrer"
                className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-green-200 bg-green-50 px-3 py-1.5 text-sm font-medium text-green-700 hover:bg-green-100"
              >
                <WhatsAppIcon className="h-4 w-4" />
                Enviar WhatsApp
              </a>
            ) : (
              <span className="text-xs text-slate-400">Sin número registrado</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Estado del plan de pago (sección nueva, SOLO LECTURA a propósito): docente que
// comparte un curso con el alumno, o admin/coordinación —
// academics_service.require_student_billing_access, más angosto que el resto de
// la ficha (nunca el propio alumno ni su tutor). Un 404 aquí no es un error que
// mostrar: simplemente esta sección no aplica a quien mira la ficha, así que se
// omite en silencio. Registrar/anular un pago vive en el módulo administrativo de
// Administración > Pagos (BillingAdminPage.tsx), no aquí — esta vista nunca
// muta nada, ni siquiera para quien tiene billing:manage.
function StudentPaymentSection({ studentId }: { studentId: string }) {
  const { data, isLoading, error } = useQuery<StudentPaymentPlan | null>({
    queryKey: ["students", studentId, "payment-status"],
    queryFn: async () => (await apiClient.get(`/students/${studentId}/payment-status`)).data,
  });

  if (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    return <ErrorState error={error} />;
  }
  if (isLoading) return <LoadingState label="Cargando plan de pago…" />;
  if (!data) return null;

  return (
    <div className="rounded-xl border border-brand-100 bg-white p-4">
      <h2 className="text-base font-semibold text-brand-900">
        Plan de pago: {data.payment_plan_name}
      </h2>
      <p className="mb-3 text-sm text-slate-500">Año académico activo</p>
      <ul className="divide-y divide-brand-50">
        {data.installments.map((installment) => (
          <li
            key={installment.id}
            className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm"
          >
            <span className="text-slate-700">{formatMonth(installment.due_date)}</span>
            <span className="text-slate-500">{formatMoney(installment.amount)}</span>
            {installment.payment && (
              <span className="text-xs text-slate-400">
                {PAYMENT_METHOD_LABEL[installment.payment.method]}
                {installment.payment.authorization_number &&
                  ` · Aut. ${installment.payment.authorization_number}`}
              </span>
            )}
            <span
              className={`rounded-full px-2 py-0.5 text-xs ring-1 ring-inset ${EFFECTIVE_STATUS_CLASS[installment.effective_status]}`}
            >
              {EFFECTIVE_STATUS_LABEL[installment.effective_status]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
