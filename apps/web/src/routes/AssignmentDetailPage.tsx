import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "../lib/apiClient";
import type { Submission } from "../lib/types";
import { ErrorState, LoadingState } from "../components/States";
import { FileAttachments } from "../components/FileAttachments";
import { useAuth } from "../context/AuthContext";

type SaveState = "idle" | "pending" | "saving" | "saved" | "offline" | "conflict" | "error";

const DEBOUNCE_MS = 2000;

export function AssignmentDetailPage() {
  const { assignmentId } = useParams<{ assignmentId: string }>();
  const queryClient = useQueryClient();
  const { activeSchoolId, me } = useAuth();
  const currentRoles =
    me?.memberships.find((m) => m.school_id === activeSchoolId)?.roles ?? [];
  const isStudent = currentRoles.includes("student");
  const isStaff = ["teacher", "school_admin", "coordinator"].some((r) =>
    currentRoles.includes(r),
  );

  const submissionQuery = useQuery<Submission | null>({
    queryKey: ["assignments", assignmentId, "my-submission"],
    queryFn: async () => (await apiClient.get(`/assignments/${assignmentId}/my-submission`)).data,
    enabled: Boolean(assignmentId) && isStudent,
  });

  const submissionsListQuery = useQuery<Submission[]>({
    queryKey: ["assignments", assignmentId, "submissions"],
    queryFn: async () => (await apiClient.get(`/assignments/${assignmentId}/submissions`)).data,
    enabled: Boolean(assignmentId) && isStaff,
  });

  const [expandedSubmissionId, setExpandedSubmissionId] = useState<string | null>(null);
  const [body, setBody] = useState("");
  const [version, setVersion] = useState(0);
  const [status, setStatus] = useState<"draft" | "submitted">("draft");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (submissionQuery.data && !initialized.current) {
      setVersion(submissionQuery.data.version);
      setStatus(submissionQuery.data.status);
      initialized.current = true;
    }
  }, [submissionQuery.data]);

  async function saveDraft(nextBody: string) {
    setSaveState("saving");
    try {
      const { data } = await apiClient.put(`/assignments/${assignmentId}/my-submission`, {
        body: nextBody,
        version,
      });
      setVersion(data.version);
      setSaveState("saved");
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setSaveState("conflict");
      } else if (error instanceof ApiError && error.status === 0) {
        setSaveState("offline");
      } else {
        setSaveState("error");
      }
    }
  }

  function onBodyChange(next: string) {
    setBody(next);
    setSaveState("pending");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => saveDraft(next), DEBOUNCE_MS);
  }

  async function onSubmit() {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setSaveState("saving");
    try {
      const { data } = await apiClient.post(
        `/assignments/${assignmentId}/my-submission/submit`,
        { body, version },
      );
      setVersion(data.version);
      setStatus(data.status);
      setSaveState("saved");
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setSaveState("conflict");
      } else {
        setSaveState("error");
      }
    }
  }

  if (isStudent && submissionQuery.isLoading) return <LoadingState />;
  if (isStudent && submissionQuery.error) return <ErrorState error={submissionQuery.error} />;

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Tarea</h1>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-medium text-slate-700">Material adjunto</h2>
        <FileAttachments
          queryKey={["assignments", assignmentId, "files"]}
          listUrl={`/assignments/${assignmentId}/files`}
          uploadUrl={isStaff ? `/assignments/${assignmentId}/files` : undefined}
          emptyLabel="El docente no adjuntó material a esta tarea."
        />
      </div>

      {isStudent && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <label className="mb-1 block text-sm font-medium" htmlFor="submission-body">
            Mi entrega
          </label>
          {submissionQuery.data && status === "draft" && (
            <p className="mb-2 text-xs text-amber-700">
              Ya tienes un borrador guardado en el servidor, pero su texto no se recarga aquí
              (limitación del MVP); si recargas la página, escribe de nuevo antes de entregar.
            </p>
          )}
          <textarea
            id="submission-body"
            className="focus-ring w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            rows={8}
            disabled={status === "submitted"}
            value={body}
            onChange={(e) => onBodyChange(e.target.value)}
            aria-describedby="save-state"
          />
          <div id="save-state" className="mt-2 flex items-center justify-between text-sm">
            <SaveIndicator state={saveState} />
            <button
              type="button"
              onClick={onSubmit}
              disabled={status === "submitted"}
              className="focus-ring rounded-md bg-sky-600 px-4 py-1.5 font-medium text-white hover:bg-sky-700 disabled:opacity-60"
            >
              {status === "submitted" ? "Entregado" : "Entregar"}
            </button>
          </div>
          {saveState === "conflict" && (
            <p role="alert" className="mt-2 text-sm text-amber-700">
              Esta entrega cambió desde otra sesión o pestaña. Recarga antes de seguir editando.
            </p>
          )}

          <div className="mt-4 border-t border-slate-100 pt-3">
            <h3 className="mb-1 text-xs font-medium text-slate-600">Archivos de mi entrega</h3>
            {submissionQuery.data ? (
              <FileAttachments
                queryKey={["submissions", submissionQuery.data.id, "files"]}
                listUrl={`/submissions/${submissionQuery.data.id}/files`}
                uploadUrl={
                  status === "submitted"
                    ? undefined
                    : `/assignments/${assignmentId}/my-submission/files`
                }
                emptyLabel="Sin archivos adjuntos todavía."
              />
            ) : (
              <FileAttachments
                queryKey={["submissions", "pending", assignmentId, "files"]}
                listUrl=""
                enabled={false}
                uploadUrl={`/assignments/${assignmentId}/my-submission/files`}
                emptyLabel="Sube un archivo o escribe tu entrega para empezar un borrador."
                onUploaded={() =>
                  queryClient.invalidateQueries({
                    queryKey: ["assignments", assignmentId, "my-submission"],
                  })
                }
              />
            )}
          </div>
        </div>
      )}

      {isStaff && (
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="mb-2 text-sm font-medium text-slate-700">Entregas de alumnos</h2>
          {submissionsListQuery.isLoading && <LoadingState />}
          {submissionsListQuery.error && <ErrorState error={submissionsListQuery.error} />}
          {submissionsListQuery.data && submissionsListQuery.data.length === 0 && (
            <p className="text-sm text-slate-500">Aún no hay entregas.</p>
          )}
          {submissionsListQuery.data && submissionsListQuery.data.length > 0 && (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-slate-500">
                  <th className="py-1">Alumno</th>
                  <th className="py-1">Estado</th>
                  <th className="py-1">Entregada</th>
                  <th className="py-1">Tardía</th>
                  <th className="py-1">Archivos</th>
                </tr>
              </thead>
              <tbody>
                {submissionsListQuery.data.map((s) => (
                  <>
                    <tr key={s.id} className="border-t border-slate-100">
                      <td className="py-1">{s.student_id.slice(0, 8)}</td>
                      <td className="py-1">{s.status}</td>
                      <td className="py-1">
                        {s.submitted_at ? new Date(s.submitted_at).toLocaleString() : "—"}
                      </td>
                      <td className="py-1">{s.late ? "Sí" : "No"}</td>
                      <td className="py-1">
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedSubmissionId((id) => (id === s.id ? null : s.id))
                          }
                          className="focus-ring rounded text-sky-700 underline hover:text-sky-900"
                        >
                          {expandedSubmissionId === s.id ? "Ocultar" : "Ver"}
                        </button>
                      </td>
                    </tr>
                    {expandedSubmissionId === s.id && (
                      <tr key={`${s.id}-files`} className="border-t border-slate-100 bg-slate-50">
                        <td colSpan={5} className="py-2">
                          <FileAttachments
                            queryKey={["submissions", s.id, "files"]}
                            listUrl={`/submissions/${s.id}/files`}
                            emptyLabel="Esta entrega no tiene archivos adjuntos."
                          />
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {!isStudent && !isStaff && (
        <p className="text-slate-500">No tienes una vista disponible para esta tarea.</p>
      )}
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  const label: Record<SaveState, string> = {
    idle: "Sin cambios",
    pending: "Pendiente de guardar…",
    saving: "Guardando…",
    saved: "Guardado en servidor",
    offline: "Sin conexión: cambios no confirmados",
    conflict: "Conflicto de versión",
    error: "Error al guardar",
  };
  const color: Record<SaveState, string> = {
    idle: "text-slate-400",
    pending: "text-slate-500",
    saving: "text-sky-600",
    saved: "text-emerald-600",
    offline: "text-red-600",
    conflict: "text-amber-700",
    error: "text-red-600",
  };
  return <span className={color[state]}>{label[state]}</span>;
}
