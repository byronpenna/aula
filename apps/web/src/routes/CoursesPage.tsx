import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiClient } from "../lib/apiClient";
import type { Course } from "../lib/types";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { StatusBadge } from "../components/StatusBadge";

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
      <h1 className="mb-4 font-display text-xl font-semibold text-brand-900">Cursos</h1>
      <ul className="grid gap-3 sm:grid-cols-2">
        {data.map((course) => (
          <li key={course.id}>
            <Link
              to={`/courses/${course.id}`}
              className="focus-ring block rounded-2xl border border-brand-100 bg-white p-4 shadow-sm transition hover:border-brand-400 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="font-display font-medium text-brand-900">
                  {course.name ?? `Curso ${course.id.slice(0, 8)}`}
                </p>
                <StatusBadge status={course.status} />
              </div>
              <p className="mt-1 text-sm text-brand-500">Ver detalle del curso</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
