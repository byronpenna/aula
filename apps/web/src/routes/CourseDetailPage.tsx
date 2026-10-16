import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiClient } from "../lib/apiClient";
import type { Assignment, Course, CourseStudent } from "../lib/types";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { StatusBadge } from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";

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
  const { activeSchoolId, me } = useAuth();
  const currentRoles = me?.memberships.find((m) => m.school_id === activeSchoolId)?.roles ?? [];
  // Crear/publicar tareas es exclusivo de quien administra el curso (sección 6); un
  // alumno o tutor solo debe ver el listado, nunca estos controles.
  const isStaff = ["teacher", "school_admin", "coordinator"].some((r) =>
    currentRoles.includes(r),
  );

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
      {courseId && <CourseNameHeader courseId={courseId} isStaff={isStaff} />}
      {isStaff && courseId && <CourseStudentsSection courseId={courseId} />}

      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Tareas del curso</h1>
        {isStaff && (
          <button
            className="focus-ring rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
            onClick={() => setShowForm((v) => !v)}
          >
            {showForm ? "Cancelar" : "Nueva tarea"}
          </button>
        )}
      </div>

      {isStaff && showForm && (
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
            className="focus-ring mt-3 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
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
              {isStaff && assignment.status === "draft" && (
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

// Nombre del curso: admin/coordinación o el docente asignado a este curso puntual
// pueden ponerlo/corregirlo (PATCH /courses/:id/name, sección 6, ver
// academics/service.py::require_course_staff_access) — nunca el PATCH genérico del
// curso, que también mueve sección/materia/año y es solo de academics:manage.
function CourseNameHeader({ courseId, isStaff }: { courseId: string; isStaff: boolean }) {
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  const { data: course, isLoading, error } = useQuery<Course>({
    queryKey: ["courses", courseId],
    queryFn: async () => (await apiClient.get(`/courses/${courseId}`)).data,
  });

  const renameMutation = useMutation({
    mutationFn: async (name: string) =>
      (await apiClient.patch(`/courses/${courseId}/name`, { name })).data,
    onSuccess: (updated: Course) => {
      queryClient.setQueryData(["courses", courseId], updated);
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      setIsEditing(false);
    },
  });

  if (isLoading) return <LoadingState label="Cargando curso…" />;
  if (error) return <ErrorState error={error} />;
  if (!course) return null;

  const label = course.name ?? `Curso ${course.id.slice(0, 8)}`;

  return (
    <div className="mb-4 rounded-lg border border-slate-200 bg-white p-4">
      {isEditing ? (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (nameDraft.trim()) renameMutation.mutate(nameDraft);
          }}
        >
          <input
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            className="focus-ring flex-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
          />
          <button
            type="submit"
            disabled={renameMutation.isPending}
            className="focus-ring rounded-md bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            Guardar
          </button>
          <button
            type="button"
            className="focus-ring rounded-md border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-100"
            onClick={() => setIsEditing(false)}
          >
            Cancelar
          </button>
        </form>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold text-slate-900">{label}</h1>
            <StatusBadge status={course.status} />
          </div>
          {isStaff && (
            <button
              type="button"
              className="focus-ring rounded-md border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-100"
              onClick={() => {
                setNameDraft(course.name ?? "");
                setIsEditing(true);
              }}
            >
              Cambiar nombre
            </button>
          )}
        </div>
      )}
      {renameMutation.isError && <ErrorState error={renameMutation.error} />}
    </div>
  );
}

// Alumnado matriculado en este curso puntual, solo lectura (no el listado general
// de /students, que requiere enrollment:manage): GET /courses/:id/students ya solo
// lo permite a admin/coordinación o al docente asignado a este curso (sección 6,
// ver academics/service.py::require_course_staff_access). Editar el nombre de un
// alumno es un flujo aparte (users:manage, /admin/users), no desde aquí.
function CourseStudentsSection({ courseId }: { courseId: string }) {
  const { data, isLoading, error } = useQuery<CourseStudent[]>({
    queryKey: ["courses", courseId, "students"],
    queryFn: async () => (await apiClient.get(`/courses/${courseId}/students`)).data,
  });

  return (
    <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-base font-semibold text-slate-900">Estudiantes inscritos</h2>

      {isLoading && <LoadingState label="Cargando estudiantes…" />}
      {error && <ErrorState error={error} />}
      {data && data.length === 0 && (
        <EmptyState
          title="Sin estudiantes matriculados"
          description="Todavía no hay alumnos inscritos en este curso."
        />
      )}
      {data && data.length > 0 && (
        <ul className="divide-y divide-slate-100">
          {data.map((student) => (
            <li key={student.id} className="py-2">
              <p className="font-medium text-slate-900">
                {student.display_name ?? "Sin nombre registrado"}
              </p>
              <p className="text-sm text-slate-500">Matrícula {student.student_number}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
