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
      <h1 className="mb-4 text-lg font-semibold">Mis hijos</h1>
      <ul className="space-y-2">
        {data.map((student) => (
          <li key={student.student_id}>
            <Link
              to={`/students/${student.student_id}/submissions`}
              className="focus-ring block rounded-lg border border-slate-200 bg-white p-4 hover:border-sky-400"
            >
              <p className="font-medium text-slate-900">
                {student.display_name ?? student.student_number}
              </p>
              <p className="text-sm text-slate-500">
                {student.relationship_label} · {student.student_number}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
