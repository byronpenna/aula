import { useRef, useState, type ChangeEvent } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiClient } from "../lib/apiClient";
import type { Assignment, Course, CourseResources, CourseStudent } from "../lib/types";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { StatusBadge } from "../components/StatusBadge";
import { downloadFile } from "../lib/download";
import { useAuth } from "../context/AuthContext";

type TabKey = "tareas" | "recursos";
const TABS: { key: TabKey; label: string }[] = [
  { key: "tareas", label: "Tareas" },
  { key: "recursos", label: "Recursos" },
];

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
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get("tab") as TabKey | null) ?? "tareas";
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

      <div className="mb-4 flex flex-wrap gap-1 border-b border-slate-200" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setSearchParams({ tab: t.key })}
            className={`focus-ring rounded-t-md px-3 py-2 text-sm font-medium ${
              tab === t.key
                ? "border-b-2 border-brand-600 text-brand-900"
                : "text-slate-500 hover:text-slate-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "recursos" && courseId && (
        <CourseResourcesSection courseId={courseId} isStaff={isStaff} />
      )}

      {tab === "tareas" && (
        <>
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
        </>
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

// Alumnado matriculado en este curso puntual, solo lectura en el listado (no el
// listado general de /students, que requiere enrollment:manage): GET
// /courses/:id/students ya solo lo permite a admin/coordinación o al docente
// asignado a este curso (sección 6, ver
// academics/service.py::require_course_staff_access). Editar el nombre de un
// alumno es un flujo aparte (users:manage, /admin/users), no desde aquí.
// "Inscribir alumno" sí es de aquí: atajo de matrícula scopeado a este curso
// (POST /courses/:id/students, academics_service.enroll_student_in_course) que no
// exige enrollment:manage — a diferencia del formulario completo de
// Administración > Academia > Inscripciones, que sigue siendo el único lugar
// para elegir sección/año desde cero.
function CourseStudentsSection({ courseId }: { courseId: string }) {
  const queryClient = useQueryClient();
  const [isEnrolling, setIsEnrolling] = useState(false);
  const [selectedStudentId, setSelectedStudentId] = useState("");

  const { data, isLoading, error } = useQuery<CourseStudent[]>({
    queryKey: ["courses", courseId, "students"],
    queryFn: async () => (await apiClient.get(`/courses/${courseId}/students`)).data,
  });

  const candidates = useQuery<CourseStudent[]>({
    queryKey: ["courses", courseId, "enrollable-students"],
    queryFn: async () => (await apiClient.get(`/courses/${courseId}/enrollable-students`)).data,
    enabled: isEnrolling,
  });

  const enrollMutation = useMutation({
    mutationFn: async (studentId: string) =>
      (await apiClient.post(`/courses/${courseId}/students`, { student_id: studentId })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses", courseId, "students"] });
      queryClient.invalidateQueries({ queryKey: ["courses", courseId, "enrollable-students"] });
      setSelectedStudentId("");
      setIsEnrolling(false);
    },
  });

  const candidateLabel = (student: CourseStudent) =>
    student.display_name
      ? `${student.display_name} (${student.student_number})`
      : student.student_number;

  return (
    <section className="mb-6 rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">Estudiantes inscritos</h2>
        <button
          type="button"
          className="focus-ring rounded-md border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-100"
          onClick={() => setIsEnrolling((v) => !v)}
        >
          {isEnrolling ? "Cancelar" : "Inscribir alumno"}
        </button>
      </div>

      {isEnrolling && (
        <form
          className="mb-3 flex flex-wrap items-center gap-2 rounded-md bg-slate-50 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (selectedStudentId) enrollMutation.mutate(selectedStudentId);
          }}
        >
          {candidates.isLoading && <LoadingState label="Cargando alumnos…" />}
          {candidates.error && <ErrorState error={candidates.error} />}
          {candidates.data && candidates.data.length === 0 && (
            <p className="text-sm text-slate-500">
              No hay alumnos del colegio pendientes de inscribir en este curso.
            </p>
          )}
          {candidates.data && candidates.data.length > 0 && (
            <>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="focus-ring flex-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
              >
                <option value="">Selecciona un alumno…</option>
                {candidates.data.map((student) => (
                  <option key={student.id} value={student.id}>
                    {candidateLabel(student)}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={!selectedStudentId || enrollMutation.isPending}
                className="focus-ring rounded-md bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                Inscribir
              </button>
            </>
          )}
          {enrollMutation.isError && <ErrorState error={enrollMutation.error} />}
        </form>
      )}

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

// Recursos del curso (PDFs agrupados en secciones, sección nueva): verlos alcanza
// con acceso de lectura al curso (alumno/tutor incluidos, de ahí que este
// componente no esté detrás de `isStaff` como CourseStudentsSection); crear,
// renombrar o eliminar secciones y subir PDFs sí es solo de quien administra el
// curso (reforzado en el backend por
// academics_service.require_course_staff_access). Eliminar una sección nunca
// borra sus PDFs (sección 6): el backend los sigue devolviendo, agrupados en
// `unsectioned_files` (ver learning_service.get_course_resources).
function CourseResourcesSection({ courseId, isStaff }: { courseId: string; isStaff: boolean }) {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  const queryKey = ["courses", courseId, "resource-sections"];
  const { data, isLoading, error } = useQuery<CourseResources>({
    queryKey,
    queryFn: async () => (await apiClient.get(`/courses/${courseId}/resource-sections`)).data,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const createMutation = useMutation({
    mutationFn: async (name: string) =>
      (await apiClient.post(`/courses/${courseId}/resource-sections`, { name })).data,
    onSuccess: () => {
      invalidate();
      setNewSectionName("");
      setIsCreating(false);
    },
  });

  const renameMutation = useMutation({
    mutationFn: async ({ sectionId, name }: { sectionId: string; name: string }) =>
      (await apiClient.patch(`/resource-sections/${sectionId}`, { name })).data,
    onSuccess: () => {
      invalidate();
      setEditingSectionId(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (sectionId: string) =>
      (await apiClient.delete(`/resource-sections/${sectionId}`)).data,
    onSuccess: invalidate,
  });

  if (isLoading) return <LoadingState label="Cargando recursos…" />;
  if (error) return <ErrorState error={error} />;
  if (!data) return null;

  const hasNothing = data.sections.length === 0 && data.unsectioned_files.length === 0;

  return (
    <div>
      {isStaff && (
        <div className="mb-4">
          {isCreating ? (
            <form
              className="flex flex-wrap items-center gap-2 rounded-md bg-slate-50 p-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (newSectionName.trim()) createMutation.mutate(newSectionName);
              }}
            >
              <input
                autoFocus
                value={newSectionName}
                onChange={(e) => setNewSectionName(e.target.value)}
                placeholder="Nombre de la sección"
                className="focus-ring flex-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
              />
              <button
                type="submit"
                disabled={createMutation.isPending}
                className="focus-ring rounded-md bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                Crear
              </button>
              <button
                type="button"
                className="focus-ring rounded-md border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-100"
                onClick={() => setIsCreating(false)}
              >
                Cancelar
              </button>
            </form>
          ) : (
            <button
              type="button"
              className="focus-ring rounded-md border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-100"
              onClick={() => setIsCreating(true)}
            >
              Nueva sección
            </button>
          )}
          {createMutation.isError && <ErrorState error={createMutation.error} />}
        </div>
      )}

      {hasNothing && (
        <EmptyState
          title="Sin recursos todavía"
          description={
            isStaff
              ? "Crea una sección y sube los primeros PDFs para que los alumnos los vean."
              : "El docente todavía no ha subido material para este curso."
          }
        />
      )}

      <div className="space-y-4">
        {data.sections.map((section) => (
          <section key={section.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              {editingSectionId === section.id ? (
                <form
                  className="flex flex-1 items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (editName.trim()) {
                      renameMutation.mutate({ sectionId: section.id, name: editName });
                    }
                  }}
                >
                  <input
                    autoFocus
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
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
                    onClick={() => setEditingSectionId(null)}
                  >
                    Cancelar
                  </button>
                </form>
              ) : (
                <>
                  <h3 className="font-medium text-slate-900">{section.name}</h3>
                  {isStaff && (
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        className="focus-ring rounded-md border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-100"
                        onClick={() => {
                          setEditName(section.name);
                          setEditingSectionId(section.id);
                        }}
                      >
                        Renombrar
                      </button>
                      <button
                        type="button"
                        className="focus-ring rounded-md border border-red-200 px-2.5 py-1 text-xs text-red-700 hover:bg-red-50"
                        onClick={() => {
                          if (
                            confirm(
                              `¿Eliminar la sección "${section.name}"? Los PDFs no se borran, quedan sin sección.`,
                            )
                          ) {
                            deleteMutation.mutate(section.id);
                          }
                        }}
                      >
                        Eliminar
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {section.files.length === 0 ? (
              <p className="text-sm text-slate-500">Sin archivos todavía.</p>
            ) : (
              <ul className="space-y-1">
                {section.files.map((file) => (
                  <li key={file.id} className="flex items-center justify-between gap-2 text-sm">
                    <button
                      type="button"
                      onClick={() => downloadFile(file.id)}
                      className="focus-ring truncate rounded text-brand-700 underline hover:text-brand-900"
                    >
                      {file.filename}
                    </button>
                    <span className="shrink-0 text-xs text-slate-400">
                      {(file.size_bytes / 1024).toFixed(0)} KB
                    </span>
                  </li>
                ))}
              </ul>
            )}

            {isStaff && <ResourceUploadInput sectionId={section.id} onUploaded={invalidate} />}
          </section>
        ))}

        {data.unsectioned_files.length > 0 && (
          <section className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4">
            <h3 className="mb-2 font-medium text-slate-700">Sin sección</h3>
            <p className="mb-2 text-xs text-slate-500">
              PDFs cuya sección fue eliminada; siguen disponibles aquí.
            </p>
            <ul className="space-y-1">
              {data.unsectioned_files.map((file) => (
                <li key={file.id} className="flex items-center justify-between gap-2 text-sm">
                  <button
                    type="button"
                    onClick={() => downloadFile(file.id)}
                    className="focus-ring truncate rounded text-brand-700 underline hover:text-brand-900"
                  >
                    {file.filename}
                  </button>
                  <span className="shrink-0 text-xs text-slate-400">
                    {(file.size_bytes / 1024).toFixed(0)} KB
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      {deleteMutation.isError && <ErrorState error={deleteMutation.error} />}
    </div>
  );
}

// Input de subida de PDFs de una sección de recursos; separado para no repetir el
// manejo de FormData/invalidación por cada sección renderizada.
function ResourceUploadInput({
  sectionId,
  onUploaded,
}: {
  sectionId: string;
  onUploaded: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploadMutation = useMutation({
    mutationFn: async (file: globalThis.File) => {
      const formData = new FormData();
      formData.append("upload", file);
      return (await apiClient.post(`/resource-sections/${sectionId}/files`, formData)).data;
    },
    onSuccess: () => {
      if (inputRef.current) inputRef.current.value = "";
      onUploaded();
    },
  });

  function onFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) uploadMutation.mutate(file);
  }

  return (
    <div className="mt-2 border-t border-slate-100 pt-2">
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        onChange={onFileSelected}
        disabled={uploadMutation.isPending}
        className="text-sm"
      />
      {uploadMutation.isPending && <p className="text-xs text-slate-500">Subiendo…</p>}
      {uploadMutation.isError && <ErrorState error={uploadMutation.error} />}
    </div>
  );
}
