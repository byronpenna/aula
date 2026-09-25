import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiClient } from "../lib/apiClient";
import type { Course } from "../lib/types";
import { EmptyState, ErrorState, LoadingState } from "../components/States";

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
      <h1 className="mb-4 text-lg font-semibold">Cursos</h1>
      <ul className="grid gap-3 sm:grid-cols-2">
        {data.map((course) => (
          <li key={course.id}>
            <Link
              to={`/courses/${course.id}`}
              className="focus-ring block rounded-lg border border-slate-200 bg-white p-4 hover:border-brand-400"
            >
              <p className="font-medium text-slate-900">Curso {course.id.slice(0, 8)}</p>
              <p className="text-sm text-slate-500">Estado: {course.status}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
