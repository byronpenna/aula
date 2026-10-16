import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiClient } from "../lib/apiClient";
import type { Course } from "../lib/types";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { StatusBadge } from "../components/StatusBadge";

// starts_on/ends_on llegan como fechas ISO (YYYY-MM-DD); se muestran como rango
// corto en español para que la tarjeta comunique vigencia sin abrir el detalle.
const dateFormatter = new Intl.DateTimeFormat("es", { day: "numeric", month: "short" });
const yearFormatter = new Intl.DateTimeFormat("es", { year: "numeric" });

function formatCourseTerm(startsOn: string, endsOn: string): string {
  const start = new Date(startsOn);
  const end = new Date(endsOn);
  return `${dateFormatter.format(start)} – ${dateFormatter.format(end)} ${yearFormatter.format(end)}`;
}

function formatTeacherCount(count: number): string {
  if (count === 0) return "Sin docente asignado";
  return count === 1 ? "1 docente" : `${count} docentes`;
}

export function CoursesPage() {
  const { data, isLoading, error } = useQuery<Course[]>({
    queryKey: ["courses"],
    queryFn: async () => (await apiClient.get("/courses")).data,
  });

  if (isLoading) return <LoadingState label="Cargando cursos…" />;
  if (error) return <ErrorState error={error} />;
  if (!data || data.length === 0) {
    return (
      <EmptyState
        title="No hay cursos visibles todavía"
        description="Si eres docente o coordinación, crea un curso desde la API; el formulario de administración llega en una fase posterior."
      />
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-brand-900">Cursos</h1>
        <p className="mt-1 text-sm text-brand-600">
          {data.length === 1 ? "1 curso visible" : `${data.length} cursos visibles`}
        </p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((course) => {
          const name = course.name ?? `Curso ${course.id.slice(0, 8)}`;
          return (
            <li key={course.id}>
              <Link
                to={`/courses/${course.id}`}
                className="focus-ring group block h-full rounded-2xl border border-brand-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <span
                    aria-hidden="true"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-100 font-display text-lg font-bold text-brand-700 transition-colors group-hover:bg-accent-400 group-hover:text-brand-900"
                  >
                    {name.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display font-semibold text-brand-900">{name}</p>
                    <div className="mt-1">
                      <StatusBadge status={course.status} />
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-3 border-t border-brand-50 pt-3 text-sm text-brand-600">
                  <span>{formatCourseTerm(course.starts_on, course.ends_on)}</span>
                  <span aria-hidden="true" className="h-3 w-px bg-brand-200" />
                  <span>{formatTeacherCount(course.teacher_user_ids.length)}</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
