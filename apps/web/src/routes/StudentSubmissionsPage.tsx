import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/apiClient";
import type { Submission } from "../lib/types";
import { EmptyState, ErrorState, LoadingState } from "../components/States";

// Consulta por padre/tutor autorizado (sección 1, primera entrega): el backend ya
// verifica el vínculo activo; esta pantalla solo muestra lo que la API autorizó.
export function StudentSubmissionsPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const { data, isLoading, error } = useQuery<Submission[]>({
    queryKey: ["students", studentId, "submissions"],
    queryFn: async () => (await apiClient.get(`/students/${studentId}/submissions`)).data,
    enabled: Boolean(studentId),
  });

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;
  if (!data || data.length === 0) {
    return <EmptyState title="Sin entregas todavía" />;
  }

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">Entregas</h1>
      <ul className="space-y-2">
        {data.map((submission) => (
          <li
            key={submission.id}
            className="rounded-lg border border-slate-200 bg-white p-4 text-sm"
          >
            <p className="font-medium text-slate-900">Tarea {submission.assignment_id.slice(0, 8)}</p>
            <p className="text-slate-500">
              Estado: {submission.status}
              {submission.submitted_at &&
                ` · Entregada: ${new Date(submission.submitted_at).toLocaleString()}`}
              {submission.late && " · Tardía"}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
