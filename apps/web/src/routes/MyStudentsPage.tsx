import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiClient } from "../lib/apiClient";
import type { LinkedStudent } from "../lib/types";
import { EmptyState, ErrorState, LoadingState } from "../components/States";

// Tutor: selector de hijos vinculados; nunca búsqueda libre de otros alumnos (sección 10).
export function MyStudentsPage() {
  const { data, isLoading, error } = useQuery<LinkedStudent[]>({
    queryKey: ["me", "students"],
    queryFn: async () => (await apiClient.get("/me/students")).data,
  });

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  if (!data || data.length === 0) {
    return (
      <EmptyState
        title="No tienes alumnos vinculados"
        description="Solo se muestran vínculos activos autorizados por el colegio."
      />
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-brand-900">Mis hijos</h1>
        <p className="mt-1 text-sm text-brand-600">
          {data.length === 1 ? "1 alumno vinculado" : `${data.length} alumnos vinculados`}
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {data.map((student) => {
          const name = student.display_name ?? student.student_number;
          return (
            <li key={student.student_id}>
              <Link
                to={`/students/${student.student_id}/submissions`}
                className="focus-ring flex items-center gap-3 rounded-xl border border-brand-100 bg-white p-4 shadow-sm transition hover:border-brand-300 hover:shadow-md"
              >
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-100 font-display text-lg font-bold text-brand-700"
                >
                  {name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-display font-medium text-brand-900">{name}</p>
                  <p className="text-sm text-slate-500">
                    {student.relationship_label} · Matrícula {student.student_number}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
