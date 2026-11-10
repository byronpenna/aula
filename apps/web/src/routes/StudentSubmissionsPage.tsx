import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/apiClient";
import type { Submission } from "../lib/types";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { StatusBadge } from "../components/StatusBadge";
import { formatDateTime } from "../lib/dates";

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
      <h1 className="mb-4 font-display text-2xl font-bold text-brand-900">Entregas</h1>
      <ul className="space-y-2">
        {data.map((submission) => (
          <li
            key={submission.id}
            className="rounded-xl border border-brand-100 bg-white p-4 text-sm"
          >
            {/* El identificador de la tarea se trunca porque esta pantalla (vista de
                tutor) no recibe su título desde el backend (SubmissionOut no lo
                incluye); mostrarlo bien requeriría agregar ese campo en la API. */}
            <p className="font-medium text-brand-900">Tarea {submission.assignment_id.slice(0, 8)}</p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-slate-500">
              <StatusBadge status={submission.status} />
              {submission.submitted_at && <span>Entregada: {formatDateTime(submission.submitted_at)}</span>}
              {submission.late && <span className="font-medium text-amber-700">Tardía</span>}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
