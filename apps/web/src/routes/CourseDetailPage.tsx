import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiClient } from "../lib/apiClient";
import type { Assignment } from "../lib/types";
import { EmptyState, ErrorState, LoadingState } from "../components/States";

// max_score se mantiene como string en el formulario (los inputs HTML son texto) y
// se convierte a número solo al enviar; evita el desajuste de tipos input/output de
// z.coerce con el resolver de react-hook-form.
const assignmentSchema = z.object({
  title: z.string().min(1, "El título es obligatorio."),
  instructions: z.string().optional(),
  due_at: z.string().min(1, "La fecha límite es obligatoria."),
  max_score: z
    .string()
    .min(1, "El puntaje máximo es obligatorio.")
    .refine((v) => Number(v) > 0, "Debe ser mayor que cero."),
  allow_late: z.boolean().optional(),
});

type AssignmentForm = z.infer<typeof assignmentSchema>;

export function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading, error } = useQuery<Assignment[]>({
    queryKey: ["courses", courseId, "assignments"],
    queryFn: async () => (await apiClient.get(`/courses/${courseId}/assignments`)).data,
    enabled: Boolean(courseId),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<AssignmentForm>({ resolver: zodResolver(assignmentSchema) });

  const createMutation = useMutation({
    mutationFn: async (values: AssignmentForm) =>
      (
        await apiClient.post(`/courses/${courseId}/assignments`, {
          ...values,
          due_at: new Date(values.due_at).toISOString(),
          max_score: values.max_score,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses", courseId, "assignments"] });
      reset();
      setShowForm(false);
    },
  });

  const publishMutation = useMutation({
    mutationFn: async (assignmentId: string) =>
      (await apiClient.post(`/assignments/${assignmentId}/publish`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses", courseId, "assignments"] });
    },
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Tareas del curso</h1>
        <button
          className="focus-ring rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? "Cancelar" : "Nueva tarea"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleSubmit((values) => createMutation.mutate(values))}
          className="mb-6 rounded-lg border border-slate-200 bg-white p-4"
          noValidate
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="title">
                Título
              </label>
              <input
                id="title"
                className="focus-ring w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                {...register("title")}
              />
              {errors.title && <p className="text-sm text-red-600">{errors.title.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="due_at">
                Fecha límite
              </label>
              <input
                id="due_at"
                type="datetime-local"
                className="focus-ring w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                {...register("due_at")}
              />
              {errors.due_at && <p className="text-sm text-red-600">{errors.due_at.message}</p>}
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="max_score">
                Puntaje máximo
              </label>
              <input
                id="max_score"
                type="number"
                step="0.01"
                defaultValue={100}
                className="focus-ring w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                {...register("max_score")}
              />
              {errors.max_score && (
                <p className="text-sm text-red-600">{errors.max_score.message}</p>
              )}
            </div>
            <div className="flex items-end gap-2">
              <input id="allow_late" type="checkbox" {...register("allow_late")} />
              <label htmlFor="allow_late" className="text-sm">
                Admite entregas tardías
              </label>
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium" htmlFor="instructions">
                Instrucciones
              </label>
              <textarea
                id="instructions"
                className="focus-ring w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                rows={3}
                {...register("instructions")}
              />
            </div>
          </div>
          {createMutation.isError && <ErrorState error={createMutation.error} />}
          <button
            type="submit"
            disabled={isSubmitting}
            className="focus-ring mt-3 rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
          >
            Guardar borrador
          </button>
        </form>
      )}

      {isLoading && <LoadingState />}
      {error && <ErrorState error={error} />}
      {data && data.length === 0 && (
        <EmptyState
          title="Sin tareas todavía"
          description="Las tareas en borrador solo las ve quien las administra; los alumnos verán las publicadas."
        />
      )}
      {data && data.length > 0 && (
        <ul className="space-y-2">
          {data.map((assignment) => (
            <li
              key={assignment.id}
              className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4"
            >
              <div>
                <Link
                  to={`/assignments/${assignment.id}`}
                  className="focus-ring font-medium text-slate-900 hover:underline"
                >
                  {assignment.title}
                </Link>
                <p className="text-sm text-slate-500">
                  Vence {new Date(assignment.due_at).toLocaleString()} · {assignment.status}
                </p>
              </div>
              {assignment.status === "draft" && (
                <button
                  className="focus-ring rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
                  onClick={() => publishMutation.mutate(assignment.id)}
                >
                  Publicar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
