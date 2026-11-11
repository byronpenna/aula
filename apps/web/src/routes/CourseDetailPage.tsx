import { lazy, Suspense, useRef, useState, type ChangeEvent } from "react";
import { useParams, useSearchParams, Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiClient } from "../lib/apiClient";
import type {
  Assignment,
  Course,
  CourseCalendarEvent,
  CourseResources,
  CourseScheduleSlot,
  CourseStudent,
  FileAttachment,
  Permissions,
  ResourceLink,
} from "../lib/types";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { StatusBadge } from "../components/StatusBadge";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { downloadFile } from "../lib/download";
import {
  extractTimeFromIso,
  formatDateOnly,
  formatDateParts,
  formatDateTime,
  formatTimeOnly,
} from "../lib/dates";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  DownloadIcon,
  EyeIcon,
  LinkIcon,
  PencilIcon,
  TrashIcon,
} from "../components/icons";
import { ResourceTypeBadge } from "../components/ResourceTypeBadge";
import { getResourceType, RESOURCE_TYPE_FILTERS, RESOURCE_UPLOAD_ACCEPT } from "../lib/resourceTypes";
import {
  detectLinkProvider,
  getEmbedUrl,
  getLinkHostname,
  getProviderBadgeClass,
  getProviderLabel,
  getThumbnailUrl,
  isAbsoluteHttpUrl,
} from "../lib/linkPreview";
import { StudentAvatar } from "../components/StudentAvatar";
import { DatePicker } from "../components/DatePicker";
import { LinkPreviewModal } from "../components/LinkPreviewModal";
import { CoursePostsSection } from "../components/CoursePostsSection";
import { useAuth } from "../context/AuthContext";

// pdf.js pesa bastante (visor + worker); se carga bajo demanda recién al abrir
// una vista previa, no en el bundle principal que paga toda visita a /courses.
const PdfPreviewModal = lazy(() =>
  import("../components/PdfPreviewModal").then((m) => ({ default: m.PdfPreviewModal })),
);

type TabKey = "tareas" | "recursos" | "calendario" | "posts";
const TABS: { key: TabKey; label: string }[] = [
  { key: "tareas", label: "Tareas" },
  { key: "recursos", label: "Recursos" },
  { key: "calendario", label: "Calendario" },
  { key: "posts", label: "Posts" },
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
    <div className="space-y-4">
      {courseId && <CourseNameHeader courseId={courseId} isStaff={isStaff} />}
      {isStaff && courseId && <CourseStudentsSection courseId={courseId} />}

      <div className="flex flex-wrap gap-1 border-b border-brand-100" role="tablist">
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
                : "text-brand-700 hover:text-brand-900"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "recursos" && courseId && (
        <CourseResourcesSection courseId={courseId} isStaff={isStaff} />
      )}

      {tab === "calendario" && courseId && (
        <CourseCalendarSection courseId={courseId} isStaff={isStaff} assignments={data ?? []} />
      )}

      {tab === "posts" && courseId && (
        <CoursePostsSection courseId={courseId} isStaff={isStaff} />
      )}

      {tab === "tareas" && (
        <>
          <div className="flex items-center justify-between">
            <h1 className="font-display text-xl font-semibold text-brand-900">
              Tareas del curso
            </h1>
            {isStaff && (
              <button
                className="focus-ring rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
                onClick={() => setShowForm((v) => !v)}
              >
                {showForm ? "Cancelar" : "Nueva tarea"}
              </button>
            )}
          </div>

          {isStaff && showForm && (
            <form
              onSubmit={handleSubmit((values) => createMutation.mutate(values))}
              className="rounded-xl border border-brand-100 bg-white p-4"
              noValidate
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-600" htmlFor="title">
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
                  <label className="mb-1 block text-sm font-medium text-slate-600" htmlFor="due_at">
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
                  <label
                    className="mb-1 block text-sm font-medium text-slate-600"
                    htmlFor="max_score"
                  >
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
                  <label htmlFor="allow_late" className="text-sm text-slate-600">
                    Admite entregas tardías
                  </label>
                </div>
                <div className="sm:col-span-2">
                  <label
                    className="mb-1 block text-sm font-medium text-slate-600"
                    htmlFor="instructions"
                  >
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
                  className="flex items-center justify-between rounded-xl border border-brand-100 bg-white p-4"
                >
                  <div>
                    <Link
                      to={`/assignments/${assignment.id}?courseId=${courseId}`}
                      className="focus-ring font-display font-medium text-brand-900 hover:underline"
                    >
                      {assignment.title}
                    </Link>
                    <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                      <span>Vence {formatDateTime(assignment.due_at)}</span>
                      <StatusBadge status={assignment.status} />
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
    <div>
      <Breadcrumbs items={[{ label: "Cursos", to: "/courses" }, { label }]} />
      <div className="rounded-xl border border-brand-100 bg-white p-4">
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
              <h1 className="font-display text-xl font-semibold text-brand-900">{label}</h1>
              <StatusBadge status={course.status} />
            </div>
            {isStaff && (
              <button
                type="button"
                title="Cambiar nombre"
                aria-label="Cambiar nombre del curso"
                className="focus-ring rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-100"
                onClick={() => {
                  setNameDraft(course.name ?? "");
                  setIsEditing(true);
                }}
              >
                <PencilIcon />
              </button>
            )}
          </div>
        )}
        {renameMutation.isError && <ErrorState error={renameMutation.error} />}
      </div>
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

  // La foto solo se intenta descargar para quien realmente puede verla
  // (files/service.py::get_download exige enrollment:manage para fotos de
  // alumno); sin este permiso, mostrarla igual solo produciría un 403 y un
  // aviso de "no se pudo cargar" engañoso en cada tarjeta.
  const { data: permissions } = useQuery<Permissions>({
    queryKey: ["me", "permissions"],
    queryFn: async () => (await apiClient.get("/me/permissions")).data,
  });
  const canViewPhotos = permissions?.permissions.includes("enrollment:manage") ?? false;

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
    <section className="rounded-xl border border-brand-100 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-brand-900">Estudiantes inscritos</h2>
        <button
          type="button"
          className="focus-ring rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
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
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {data.map((student) => {
            const name = student.display_name ?? "Sin nombre registrado";
            return (
              <li key={student.id}>
                <Link
                  to={`/students/${student.id}`}
                  className="focus-ring flex w-full flex-col items-center gap-2 rounded-xl border border-brand-100 bg-white p-3 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
                >
                  <StudentAvatar
                    photoFileId={canViewPhotos ? student.photo_file_id : null}
                    name={name}
                    size="h-14 w-14"
                  />
                  <div className="min-w-0 w-full">
                    <p className="truncate font-display text-sm font-medium text-brand-900">
                      {name}
                    </p>
                    <p className="truncate text-xs text-slate-500">
                      Matrícula {student.student_number}
                    </p>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// Recursos del curso (archivos agrupados en secciones, cada sección puede tener
// varios — PDF/Word/Excel/PowerPoint/imágenes/texto, ver lib/resourceTypes.ts):
// verlos alcanza con acceso de lectura al curso (alumno/tutor incluidos, de ahí
// que este componente no esté detrás de `isStaff` como CourseStudentsSection);
// crear, renombrar o eliminar secciones y subir archivos sí es solo de quien
// administra el curso (reforzado en el backend por
// academics_service.require_course_staff_access). Eliminar una sección nunca
// borra sus archivos (sección 6): el backend los sigue devolviendo, agrupados en
// `unsectioned_files` (ver learning_service.get_course_resources). El buscador de
// nombre/tipo filtra en memoria lo ya cargado, sin pedir nada nuevo a la API.
function CourseResourcesSection({ courseId, isStaff }: { courseId: string; isStaff: boolean }) {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [previewFile, setPreviewFile] = useState<{ id: string; filename: string } | null>(null);
  const [previewLink, setPreviewLink] = useState<ResourceLink | null>(null);
  const [filterName, setFilterName] = useState("");
  const [filterType, setFilterType] = useState("");

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

  const deleteLinkMutation = useMutation({
    mutationFn: async (linkId: string) => apiClient.delete(`/resource-links/${linkId}`),
    onSuccess: invalidate,
  });

  if (isLoading) return <LoadingState label="Cargando recursos…" />;
  if (error) return <ErrorState error={error} />;
  if (!data) return null;

  const hasNothing =
    data.sections.length === 0 &&
    data.unsectioned_files.length === 0 &&
    data.unsectioned_links.length === 0;

  // Filtro de nombre/tipo (sección nueva): puramente de presentación, filtra lo
  // ya cargado en memoria — no agrega un endpoint ni cambia qué recursos existen.
  // "link" no es un content-type real (ver lib/resourceTypes.ts), así que los
  // enlaces se filtran aparte con su propio chequeo de tipo (cualquier enlace,
  // sea video o página, cuenta como "Enlace").
  const hasFilter = filterName.trim() !== "" || filterType !== "";
  const normalizedName = filterName.trim().toLowerCase();
  function matchesFilter(file: FileAttachment): boolean {
    const nameMatches = !normalizedName || file.filename.toLowerCase().includes(normalizedName);
    const typeMatches = !filterType || getResourceType(file.content_type).key === filterType;
    return nameMatches && typeMatches;
  }
  function matchesLinkFilter(link: ResourceLink): boolean {
    const nameMatches = !normalizedName || link.title.toLowerCase().includes(normalizedName);
    const typeMatches = !filterType || filterType === "link";
    return nameMatches && typeMatches;
  }
  const visibleSections = data.sections
    .map((section) => ({
      ...section,
      files: section.files.filter(matchesFilter),
      links: section.links.filter(matchesLinkFilter),
    }))
    .filter((section) => !hasFilter || section.files.length > 0 || section.links.length > 0);
  const visibleUnsectionedFiles = data.unsectioned_files.filter(matchesFilter);
  const visibleUnsectionedLinks = data.unsectioned_links.filter(matchesLinkFilter);
  const noFilterMatches =
    hasFilter &&
    !hasNothing &&
    visibleSections.length === 0 &&
    visibleUnsectionedFiles.length === 0 &&
    visibleUnsectionedLinks.length === 0;

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
              className="focus-ring rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
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
              ? "Crea una sección y sube los primeros archivos para que los alumnos los vean."
              : "El docente todavía no ha subido material para este curso."
          }
        />
      )}

      {!hasNothing && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <input
            value={filterName}
            onChange={(e) => setFilterName(e.target.value)}
            placeholder="Buscar por nombre…"
            aria-label="Buscar recursos por nombre"
            className="focus-ring min-w-[12rem] flex-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
          />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            aria-label="Filtrar por tipo de recurso"
            className="focus-ring rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
          >
            <option value="">Todos los tipos</option>
            {RESOURCE_TYPE_FILTERS.map((type) => (
              <option key={type.key} value={type.key}>
                {type.label}
              </option>
            ))}
            <option value="link">Enlace</option>
          </select>
        </div>
      )}

      {noFilterMatches && (
        <EmptyState
          title="Sin resultados"
          description="Ningún recurso coincide con ese nombre o tipo. Prueba con otro filtro."
        />
      )}

      <div className="space-y-4">
        {visibleSections.map((section) => (
          <section key={section.id} className="rounded-xl border border-brand-100 bg-white p-4">
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
                  <h3 className="font-semibold text-brand-900">{section.name}</h3>
                  {isStaff && (
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        title="Renombrar"
                        aria-label={`Renombrar sección ${section.name}`}
                        className="focus-ring rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-100"
                        onClick={() => {
                          setEditName(section.name);
                          setEditingSectionId(section.id);
                        }}
                      >
                        <PencilIcon />
                      </button>
                      <ResourceLinkCreateInput sectionId={section.id} onCreated={invalidate} />
                      <button
                        type="button"
                        title="Eliminar"
                        aria-label={`Eliminar sección ${section.name}`}
                        className="focus-ring rounded-md border border-red-200 p-1.5 text-red-700 hover:bg-red-50"
                        onClick={() => {
                          if (
                            confirm(
                              `¿Eliminar la sección "${section.name}"? Sus archivos no se borran, quedan sin sección.`,
                            )
                          ) {
                            deleteMutation.mutate(section.id);
                          }
                        }}
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            {section.files.length === 0 && section.links.length === 0 ? (
              <p className="text-sm text-slate-500">Sin archivos ni enlaces todavía.</p>
            ) : (
              <ResourceFileList
                files={section.files}
                links={section.links}
                onPreviewFile={setPreviewFile}
                onPreviewLink={setPreviewLink}
                canManage={isStaff}
                onDeleteLink={(linkId) => {
                  if (confirm("¿Quitar este enlace de la sección? Sus comentarios también se borran.")) {
                    deleteLinkMutation.mutate(linkId);
                  }
                }}
              />
            )}

            {isStaff && (
              <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-brand-50 pt-2">
                <ResourceUploadInput sectionId={section.id} onUploaded={invalidate} />
              </div>
            )}
          </section>
        ))}

        {(visibleUnsectionedFiles.length > 0 || visibleUnsectionedLinks.length > 0) && (
          <section className="rounded-xl border border-dashed border-brand-200 bg-brand-50/60 p-4">
            <h3 className="mb-2 font-semibold text-brand-800">Sin sección</h3>
            <p className="mb-2 text-xs text-slate-500">
              Recursos cuya sección fue eliminada; siguen disponibles aquí.
            </p>
            <ResourceFileList
              files={visibleUnsectionedFiles}
              links={visibleUnsectionedLinks}
              onPreviewFile={setPreviewFile}
              onPreviewLink={setPreviewLink}
              canManage={isStaff}
              onDeleteLink={(linkId) => {
                if (confirm("¿Quitar este enlace? Sus comentarios también se borran.")) {
                  deleteLinkMutation.mutate(linkId);
                }
              }}
            />
          </section>
        )}
      </div>
      {deleteMutation.isError && <ErrorState error={deleteMutation.error} />}
      {deleteLinkMutation.isError && <ErrorState error={deleteLinkMutation.error} />}

      {previewFile && (
        <Suspense fallback={null}>
          <PdfPreviewModal
            fileId={previewFile.id}
            filename={previewFile.filename}
            isStaff={isStaff}
            onClose={() => setPreviewFile(null)}
          />
        </Suspense>
      )}

      {previewLink && <LinkPreviewModal link={previewLink} onClose={() => setPreviewLink(null)} />}
    </div>
  );
}

type CalendarItem =
  | {
      kind: "event";
      id: string;
      date: string;
      time: string | null;
      title: string;
      description: string | null;
    }
  | {
      kind: "assignment";
      id: string;
      date: string;
      time: string | null;
      title: string;
      status: Assignment["status"];
    }
  | {
      kind: "schedule";
      id: string;
      date: string;
      time: string | null;
      title: string;
      location: string | null;
    };

// Sin hora (fecha importante "todo el día") va antes que cualquier hora
// puntual del mismo día; entre dos horas puntuales, orden ascendente.
function compareCalendarItems(a: CalendarItem, b: CalendarItem): number {
  if (a.date !== b.date) return a.date.localeCompare(b.date);
  if (a.time === b.time) return 0;
  if (a.time === null) return -1;
  if (b.time === null) return 1;
  return a.time.localeCompare(b.time);
}

function monthStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}
function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
// due_at trae hora y zona (ISO completo), así que sí se puede parsear con
// `new Date(...)` normal — a diferencia de event_date (ver lib/dates.ts).
function dueDateKey(dueAt: string): string {
  return dateKey(new Date(dueAt));
}
const MONTH_LABEL_FORMATTER = new Intl.DateTimeFormat("es", { month: "long", year: "numeric" });
const WEEKDAY_LABELS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const CALENDAR_ITEM_DOT_CLASS: Record<CalendarItem["kind"], string> = {
  assignment: "bg-amber-500",
  event: "bg-brand-500",
  schedule: "bg-emerald-500",
};

// Expande las franjas recurrentes del horario de clases (GET /courses/:id/schedule,
// solo cursos "presencial"/"mixto") en ocurrencias concretas del mes visible —
// igual criterio que las tareas: nunca se materializan como CourseCalendarEvent,
// se calculan al vuelo aquí (ver CourseScheduleSlot en academics/models.py).
function expandScheduleForMonth(
  slots: CourseScheduleSlot[],
  year: number,
  month: number,
): CalendarItem[] {
  if (slots.length === 0) return [];
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const items: CalendarItem[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const weekday = (date.getDay() + 6) % 7; // 0 = lunes, igual que el grid del mes
    for (const slot of slots) {
      if (slot.weekday !== weekday) continue;
      items.push({
        kind: "schedule",
        id: `${slot.id}-${dateKey(date)}`,
        date: dateKey(date),
        time: formatTimeOnly(slot.start_time),
        title: "Clase presencial",
        location: slot.location,
      });
    }
  }
  return items;
}

// Calendario del curso (sección nueva): combina las fechas importantes que
// agrega quien administra el curso (GET /courses/:id/calendar-events) con las
// fechas de vencimiento de las tareas ya existentes (prop `assignments`,
// reutiliza la misma consulta que ya hace la pestaña "Tareas" — nunca se pide
// dos veces). Un alumno ve exactamente las tareas que `list_assignments` ya le
// filtra (solo publicadas); las fechas importantes son visibles para
// cualquiera con acceso al curso, pero solo quien administra el curso puede
// agregarlas o quitarlas (ver learning/service.py::create_calendar_event).
function CourseCalendarSection({
  courseId,
  isStaff,
  assignments,
}: {
  courseId: string;
  isStaff: boolean;
  assignments: Assignment[];
}) {
  const queryClient = useQueryClient();
  const [viewMonth, setViewMonth] = useState(() => monthStart(new Date()));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const queryKey = ["courses", courseId, "calendar-events"];
  const { data, isLoading, error } = useQuery<CourseCalendarEvent[]>({
    queryKey,
    queryFn: async () => (await apiClient.get(`/courses/${courseId}/calendar-events`)).data,
  });

  // Cursos "virtual" responden lista vacía (ver academics_service.set_course_schedule),
  // así que no hace falta conocer la modalidad aquí para decidir si pedirlo.
  const { data: scheduleSlots } = useQuery<CourseScheduleSlot[]>({
    queryKey: ["courses", courseId, "schedule"],
    queryFn: async () => (await apiClient.get(`/courses/${courseId}/schedule`)).data,
  });

  const deleteMutation = useMutation({
    mutationFn: async (eventId: string) => apiClient.delete(`/calendar-events/${eventId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  if (isLoading) return <LoadingState label="Cargando calendario…" />;
  if (error) return <ErrorState error={error} />;

  const items: CalendarItem[] = [
    ...(data ?? []).map(
      (e): CalendarItem => ({
        kind: "event",
        id: e.id,
        date: e.event_date,
        time: e.event_time ? formatTimeOnly(e.event_time) : null,
        title: e.title,
        description: e.description,
      }),
    ),
    ...assignments.map(
      (a): CalendarItem => ({
        kind: "assignment",
        id: a.id,
        date: dueDateKey(a.due_at),
        time: extractTimeFromIso(a.due_at),
        title: a.title,
        status: a.status,
      }),
    ),
    ...expandScheduleForMonth(scheduleSlots ?? [], viewMonth.getFullYear(), viewMonth.getMonth()),
  ].sort(compareCalendarItems);

  const itemsByDate = new Map<string, CalendarItem[]>();
  for (const item of items) {
    const list = itemsByDate.get(item.date) ?? [];
    list.push(item);
    itemsByDate.set(item.date, list);
  }

  const year = viewMonth.getFullYear();
  const month = viewMonth.getMonth();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // 0 = lunes
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];
  const todayKey = dateKey(new Date());

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold text-brand-900">Calendario del curso</h1>
        {isStaff && (
          <button
            type="button"
            className="focus-ring rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            onClick={() => setIsModalOpen(true)}
          >
            Nueva fecha importante
          </button>
        )}
      </div>

      <div className="rounded-xl border border-brand-100 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setViewMonth((d) => addMonths(d, -1))}
            title="Mes anterior"
            aria-label="Mes anterior"
            className="focus-ring rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-100"
          >
            <ChevronLeftIcon />
          </button>
          <p className="font-display font-semibold text-brand-900 capitalize">
            {MONTH_LABEL_FORMATTER.format(viewMonth)}
          </p>
          <button
            type="button"
            onClick={() => setViewMonth((d) => addMonths(d, 1))}
            title="Mes siguiente"
            aria-label="Mes siguiente"
            className="focus-ring rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-100"
          >
            <ChevronRightIcon />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-brand-600">
          {WEEKDAY_LABELS.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (!day) return <span key={`blank-${i}`} />;
            const key = dateKey(day);
            const dayItems = itemsByDate.get(key) ?? [];
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedDate(key)}
                title={
                  dayItems.length > 0
                    ? `${dayItems.length === 1 ? "1 actividad" : `${dayItems.length} actividades`} — ver día`
                    : "Ver día"
                }
                aria-label={`${formatDateOnly(key)}${dayItems.length > 0 ? `, ${dayItems.length} actividad(es)` : ""}`}
                className={`focus-ring flex flex-col items-center gap-0.5 rounded-md py-1.5 text-sm hover:bg-brand-50 ${
                  key === todayKey ? "bg-brand-50 font-semibold text-brand-900" : "text-slate-700"
                }`}
              >
                <span>{day.getDate()}</span>
                {dayItems.length > 0 && (
                  <span className="flex gap-0.5" aria-hidden="true">
                    {dayItems.slice(0, 3).map((item) => (
                      <span
                        key={item.id}
                        className={`h-1.5 w-1.5 rounded-full ${CALENDAR_ITEM_DOT_CLASS[item.kind]}`}
                      />
                    ))}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {items.length === 0 ? (
        <EmptyState
          title="Sin fechas todavía"
          description="Las tareas publicadas y las fechas importantes que agregues aparecerán aquí."
        />
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={`${item.kind}-${item.id}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-brand-100 bg-white p-3"
            >
              <div className="flex items-center gap-3">
                <div className="flex w-14 shrink-0 flex-col items-center rounded-md bg-brand-50 py-1 text-brand-700">
                  <span className="text-base font-semibold leading-none">
                    {formatDateParts(item.date).day}
                  </span>
                  <span className="text-xs uppercase">{formatDateParts(item.date).month}</span>
                </div>
                <div className="min-w-0">
                  {item.kind === "assignment" ? (
                    <Link
                      to={`/assignments/${item.id}?courseId=${courseId}`}
                      className="focus-ring font-medium text-brand-900 hover:underline"
                    >
                      {item.title}
                    </Link>
                  ) : (
                    <p className="font-medium text-brand-900">{item.title}</p>
                  )}
                  <p className="text-xs text-slate-500">
                    {item.time ?? "Todo el día"}
                  </p>
                  {item.kind === "event" && item.description && (
                    <p className="text-sm text-slate-500">{item.description}</p>
                  )}
                  {item.kind === "schedule" && item.location && (
                    <p className="text-sm text-slate-500">{item.location}</p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {item.kind === "assignment" && <StatusBadge status={item.status} />}
                {item.kind === "event" && (
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-200">
                    Fecha importante
                  </span>
                )}
                {item.kind === "schedule" && (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                    Clase presencial
                  </span>
                )}
                {isStaff && item.kind === "event" && (
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`¿Quitar "${item.title}" del calendario?`)) {
                        deleteMutation.mutate(item.id);
                      }
                    }}
                    title="Quitar"
                    aria-label={`Quitar ${item.title}`}
                    className="focus-ring rounded-md border border-red-200 p-1.5 text-red-700 hover:bg-red-50"
                  >
                    <TrashIcon />
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
      {deleteMutation.isError && <ErrorState error={deleteMutation.error} />}

      {isModalOpen && (
        <NewCalendarEventModal
          courseId={courseId}
          items={items}
          onClose={() => setIsModalOpen(false)}
          onCreated={() => {
            setIsModalOpen(false);
            queryClient.invalidateQueries({ queryKey });
          }}
        />
      )}

      {selectedDate && (
        <DayEventsModal
          date={selectedDate}
          items={itemsByDate.get(selectedDate) ?? []}
          courseId={courseId}
          isStaff={isStaff}
          onClose={() => setSelectedDate(null)}
          onDeleteEvent={(eventId) => {
            if (confirm("¿Quitar esta fecha importante del calendario?")) {
              deleteMutation.mutate(eventId);
            }
          }}
          onCreated={() => queryClient.invalidateQueries({ queryKey })}
        />
      )}
    </div>
  );
}

// Modal que abre un día de la cuadrícula (clic sobre el número): muestra las
// actividades de ese día puntual (tareas y fechas importantes) y, para quien
// administra el curso, un formulario para agregar una fecha importante nueva
// ya con ese día fijado — sin tener que volver a elegirlo en otro cuadro.
function DayEventsModal({
  date,
  items,
  courseId,
  isStaff,
  onClose,
  onDeleteEvent,
  onCreated,
}: {
  date: string;
  items: CalendarItem[];
  courseId: string;
  isStaff: boolean;
  onClose: () => void;
  onDeleteEvent: (eventId: string) => void;
  onCreated: () => void;
}) {
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventTime, setEventTime] = useState("");

  const createMutation = useMutation({
    mutationFn: async () =>
      (
        await apiClient.post(`/courses/${courseId}/calendar-events`, {
          title,
          event_date: date,
          event_time: eventTime || null,
          description: description.trim() || null,
        })
      ).data,
    onSuccess: () => {
      setTitle("");
      setDescription("");
      setEventTime("");
      setIsAdding(false);
      onCreated();
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-brand-100 p-3">
          <p className="font-display font-medium text-brand-900">{formatDateOnly(date)}</p>
          <button
            type="button"
            onClick={onClose}
            title="Cerrar"
            aria-label="Cerrar"
            className="focus-ring rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-100"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto p-4">
          {items.length === 0 ? (
            <p className="text-sm text-slate-500">Sin actividades este día.</p>
          ) : (
            <ul className="space-y-2">
              {items.map((item) => (
                <li
                  key={`${item.kind}-${item.id}`}
                  className="flex items-center justify-between gap-2 rounded-lg border border-brand-100 bg-white p-2.5"
                >
                  <div className="min-w-0">
                    {item.kind === "assignment" ? (
                      <Link
                        to={`/assignments/${item.id}?courseId=${courseId}`}
                        className="focus-ring text-sm font-medium text-brand-900 hover:underline"
                      >
                        {item.title}
                      </Link>
                    ) : (
                      <p className="text-sm font-medium text-brand-900">{item.title}</p>
                    )}
                    <p className="text-xs text-slate-500">{item.time ?? "Todo el día"}</p>
                    {item.kind === "event" && item.description && (
                      <p className="text-xs text-slate-500">{item.description}</p>
                    )}
                    {item.kind === "schedule" && item.location && (
                      <p className="text-xs text-slate-500">{item.location}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {item.kind === "assignment" && <StatusBadge status={item.status} />}
                    {item.kind === "event" && (
                      <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 ring-1 ring-inset ring-brand-200">
                        Fecha importante
                      </span>
                    )}
                    {item.kind === "schedule" && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                        Clase presencial
                      </span>
                    )}
                    {isStaff && item.kind === "event" && (
                      <button
                        type="button"
                        onClick={() => onDeleteEvent(item.id)}
                        title="Quitar"
                        aria-label={`Quitar ${item.title}`}
                        className="focus-ring rounded-md border border-red-200 p-1.5 text-red-700 hover:bg-red-50"
                      >
                        <TrashIcon />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {isStaff &&
            (isAdding ? (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (title.trim()) createMutation.mutate();
                }}
                className="space-y-2 rounded-lg border border-brand-100 bg-brand-50/40 p-3"
              >
                <input
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Título"
                  className="focus-ring w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
                />
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-600" htmlFor="day-modal-time">
                    Hora (opcional)
                  </label>
                  <input
                    id="day-modal-time"
                    type="time"
                    value={eventTime}
                    onChange={(e) => setEventTime(e.target.value)}
                    className="focus-ring rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
                  />
                  {eventTime && (
                    <button
                      type="button"
                      onClick={() => setEventTime("")}
                      className="focus-ring text-xs text-brand-700 hover:underline"
                    >
                      Quitar hora
                    </button>
                  )}
                </div>
                <input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descripción (opcional)"
                  className="focus-ring w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
                />
                {createMutation.isError && <ErrorState error={createMutation.error} />}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAdding(false)}
                    className="focus-ring rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={!title.trim() || createMutation.isPending}
                    className="focus-ring rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                  >
                    Guardar
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setIsAdding(true)}
                className="focus-ring w-full rounded-md border border-dashed border-brand-300 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
              >
                + Agregar fecha importante este día
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}

// Cuadro modal para agregar una fecha importante (mismo patrón de overlay que
// AddLinkModal): al elegir la fecha se muestra de inmediato la "vista del
// día" — todo lo que ya está programado ese mismo día (otras fechas
// importantes y vencimientos de tareas, vía la prop `items` que
// CourseCalendarSection ya tiene calculada) — para que quien administra el
// curso vea de un vistazo si hay un cruce antes de guardar. No bloquea
// guardar aunque haya cruce: es información para decidir, no una validación.
function NewCalendarEventModal({
  courseId,
  items,
  onClose,
  onCreated,
}: {
  courseId: string;
  items: CalendarItem[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [eventTime, setEventTime] = useState("");
  const [description, setDescription] = useState("");
  const dayItems = eventDate
    ? items.filter((item) => item.date === eventDate).sort(compareCalendarItems)
    : [];

  const createMutation = useMutation({
    mutationFn: async () =>
      (
        await apiClient.post(`/courses/${courseId}/calendar-events`, {
          title,
          event_date: eventDate,
          event_time: eventTime || null,
          description: description.trim() || null,
        })
      ).data,
    onSuccess: onCreated,
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-brand-100 p-3">
          <p className="font-display font-medium text-brand-900">Nueva fecha importante</p>
          <button
            type="button"
            onClick={onClose}
            title="Cerrar"
            aria-label="Cerrar"
            className="focus-ring rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-100"
          >
            <CloseIcon />
          </button>
        </div>

        <form
          className="space-y-3 overflow-y-auto p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim() && eventDate) createMutation.mutate();
          }}
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="cal-title">
              Título
            </label>
            <input
              id="cal-title"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Examen parcial"
              className="focus-ring w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="cal-date">
                Fecha
              </label>
              <DatePicker id="cal-date" value={eventDate} onChange={setEventDate} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="cal-time">
                Hora (opcional)
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="cal-time"
                  type="time"
                  value={eventTime}
                  onChange={(e) => setEventTime(e.target.value)}
                  className="focus-ring rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
                />
                {eventTime && (
                  <button
                    type="button"
                    onClick={() => setEventTime("")}
                    className="focus-ring text-xs text-brand-700 hover:underline"
                  >
                    Quitar
                  </button>
                )}
              </div>
            </div>
          </div>

          {eventDate && (
            <div>
              <p className="mb-1 text-xs font-medium text-slate-600">
                Vista del día — {formatDateOnly(eventDate)}
              </p>
              {dayItems.length === 0 ? (
                <p className="rounded-lg border border-dashed border-brand-200 bg-brand-50/60 p-3 text-xs text-brand-700">
                  Sin otras actividades ese día.
                </p>
              ) : (
                <div className="space-y-1.5 rounded-lg border border-amber-200 bg-amber-50 p-2.5">
                  <p className="text-xs font-medium text-amber-800">
                    Ya hay {dayItems.length === 1 ? "una actividad" : `${dayItems.length} actividades`}{" "}
                    ese día:
                  </p>
                  <ul className="space-y-1">
                    {dayItems.map((item) => (
                      <li
                        key={`${item.kind}-${item.id}`}
                        className="flex items-center gap-2 text-xs text-slate-700"
                      >
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${CALENDAR_ITEM_DOT_CLASS[item.kind]}`}
                          aria-hidden="true"
                        />
                        <span className="truncate">{item.title}</span>
                        <span className="shrink-0 text-slate-400">{item.time ?? "todo el día"}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="cal-description">
              Descripción (opcional)
            </label>
            <input
              id="cal-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="focus-ring w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
            />
          </div>

          {createMutation.isError && <ErrorState error={createMutation.error} />}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              className="focus-ring rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!title.trim() || !eventDate || createMutation.isPending}
              className="focus-ring rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {createMutation.isPending ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Cuadrícula de recursos de una sección: cualquiera con acceso al curso puede
// descargarlos, y previsualizarlos si son PDF (el visor de PdfPreviewModal.tsx
// solo sabe renderizar ese formato; Word/Excel/PowerPoint/imágenes/texto solo
// ofrecen descarga). Compartida entre la cuadrícula de una sección y la de
// "Sin sección" para no duplicar las tarjetas por archivo.
function ResourceFileList({
  files,
  links,
  onPreviewFile,
  onPreviewLink,
  canManage,
  onDeleteLink,
}: {
  files: FileAttachment[];
  links: ResourceLink[];
  onPreviewFile: (file: { id: string; filename: string }) => void;
  onPreviewLink: (link: ResourceLink) => void;
  canManage: boolean;
  onDeleteLink: (linkId: string) => void;
}) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {files.map((file) => {
        const isPdf = file.content_type === "application/pdf";
        return (
          <li
            key={file.id}
            className="flex flex-col gap-2 rounded-lg border border-brand-100 bg-white p-3"
          >
            <div className="flex items-start justify-between gap-2">
              <ResourceTypeBadge contentType={file.content_type} />
              <span className="shrink-0 text-xs text-slate-400">
                {(file.size_bytes / 1024).toFixed(0)} KB
              </span>
            </div>
            <p className="line-clamp-2 flex-1 text-sm text-brand-900" title={file.filename}>
              {file.filename}
            </p>
            <div className="flex items-center gap-1 pt-1">
              {isPdf && (
                <button
                  type="button"
                  onClick={() => onPreviewFile({ id: file.id, filename: file.filename })}
                  title="Ver"
                  aria-label={`Ver ${file.filename}`}
                  className="focus-ring rounded-md border border-brand-200 p-1.5 text-brand-700 hover:bg-brand-50"
                >
                  <EyeIcon />
                </button>
              )}
              <button
                type="button"
                onClick={() => downloadFile(file.id)}
                title="Descargar"
                aria-label={`Descargar ${file.filename}`}
                className="focus-ring rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-100"
              >
                <DownloadIcon />
              </button>
            </div>
          </li>
        );
      })}

      {links.map((link) => {
        const provider = detectLinkProvider(link.url);
        const thumbnailUrl = getThumbnailUrl(link.url);
        return (
          <li
            key={link.id}
            className="flex flex-col gap-2 rounded-lg border border-brand-100 bg-white p-3"
          >
            <button
              type="button"
              onClick={() => onPreviewLink(link)}
              className="focus-ring -m-1 overflow-hidden rounded-md"
              title="Ver"
              aria-label={`Ver ${link.title}`}
            >
              {thumbnailUrl ? (
                <img src={thumbnailUrl} alt="" className="aspect-video w-full rounded-md object-cover" />
              ) : (
                <span className="flex aspect-video w-full items-center justify-center rounded-md bg-brand-50">
                  <LinkIcon className="h-6 w-6 text-brand-400" />
                </span>
              )}
            </button>
            <div className="flex items-start justify-between gap-2">
              <span
                className={`inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-[10px] font-bold tracking-wide uppercase ring-1 ring-inset ${getProviderBadgeClass(provider)}`}
              >
                {getProviderLabel(provider)}
              </span>
              <span className="truncate text-[11px] text-slate-400">{getLinkHostname(link.url)}</span>
            </div>
            <p className="line-clamp-2 flex-1 text-sm text-brand-900" title={link.title}>
              {link.title}
            </p>
            <div className="flex items-center gap-1 pt-1">
              <button
                type="button"
                onClick={() => onPreviewLink(link)}
                title="Ver"
                aria-label={`Ver ${link.title}`}
                className="focus-ring rounded-md border border-brand-200 p-1.5 text-brand-700 hover:bg-brand-50"
              >
                <EyeIcon />
              </button>
              {canManage && (
                <button
                  type="button"
                  onClick={() => onDeleteLink(link.id)}
                  title="Quitar"
                  aria-label={`Quitar enlace ${link.title}`}
                  className="focus-ring rounded-md border border-red-200 p-1.5 text-red-700 hover:bg-red-50"
                >
                  <TrashIcon />
                </button>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// Botón que abre AddLinkModal para agregar un enlace (video de YouTube/
// Facebook/TikTok, o cualquier página) como recurso de una sección; separado
// solo para no repetir la invalidación por cada sección renderizada.
function ResourceLinkCreateInput({
  sectionId,
  onCreated,
}: {
  sectionId: string;
  onCreated: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        title="Agregar enlace"
        aria-label="Agregar enlace"
        className="focus-ring rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-100"
        onClick={() => setIsOpen(true)}
      >
        <LinkIcon />
      </button>
      {isOpen && (
        <AddLinkModal
          sectionId={sectionId}
          onClose={() => setIsOpen(false)}
          onCreated={() => {
            setIsOpen(false);
            onCreated();
          }}
        />
      )}
    </>
  );
}

// Cuadro modal para agregar un enlace (mismo patrón de overlay que
// PdfPreviewModal.tsx/LinkPreviewModal.tsx): a medida que se escribe la URL se
// reconoce en el momento si es un video de un proveedor con vista previa
// incrustable (lib/linkPreview.ts, espejo del parser del backend para
// YouTube) y se muestra ese video embebido real antes de confirmar. Una
// página cualquiera (o un video de Facebook/TikTok sin un id individual
// reconocible) no tiene vista previa aquí — la mayoría de sitios bloquean
// mostrarse en un iframe — pero igual se puede agregar, solo se avisa que no
// hay vista previa disponible. Nunca se guarda nada hasta hacer clic en
// "Agregar"; el backend vuelve a validar la URL de todos modos (ver
// learning/service.py::_validate_url).
function AddLinkModal({
  sectionId,
  onClose,
  onCreated,
}: {
  sectionId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const trimmedUrl = url.trim();
  const isValidUrl = isAbsoluteHttpUrl(trimmedUrl);
  const embedUrl = isValidUrl ? getEmbedUrl(trimmedUrl) : null;

  const createMutation = useMutation({
    mutationFn: async () =>
      (await apiClient.post(`/resource-sections/${sectionId}/links`, { title, url: trimmedUrl })).data,
    onSuccess: onCreated,
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-brand-100 p-3">
          <p className="font-display font-medium text-brand-900">Agregar enlace</p>
          <button
            type="button"
            onClick={onClose}
            title="Cerrar"
            aria-label="Cerrar"
            className="focus-ring rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-100"
          >
            <CloseIcon />
          </button>
        </div>

        <form
          className="space-y-3 overflow-y-auto p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim() && isValidUrl) createMutation.mutate();
          }}
        >
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="link-title">
              Título
            </label>
            <input
              id="link-title"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Introducción al tema"
              className="focus-ring w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="link-url">
              Enlace (video de YouTube, Facebook, TikTok, o cualquier página web)
            </label>
            <input
              id="link-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              className="focus-ring w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
            />
            {trimmedUrl !== "" && !isValidUrl && (
              <p className="mt-1 text-xs text-red-600">
                Ingresa una URL completa (debe empezar con http:// o https://).
              </p>
            )}
          </div>

          {isValidUrl && (
            <div>
              <p className="mb-1 text-xs font-medium text-slate-600">Vista previa</p>
              {embedUrl ? (
                <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
                  <iframe
                    key={embedUrl}
                    src={embedUrl}
                    title="Vista previa"
                    allow="accelerometer; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="h-full w-full"
                  />
                </div>
              ) : (
                <p className="flex items-center gap-2 rounded-lg border border-dashed border-brand-200 bg-brand-50/60 p-3 text-xs text-brand-700">
                  <LinkIcon className="h-4 w-4 shrink-0" />
                  Sin vista previa disponible para este enlace; de todas formas se puede agregar.
                </p>
              )}
            </div>
          )}

          {createMutation.isError && <ErrorState error={createMutation.error} />}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              className="focus-ring rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
              onClick={onClose}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!title.trim() || !isValidUrl || createMutation.isPending}
              className="focus-ring rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {createMutation.isPending ? "Agregando…" : "Agregar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Input de subida de recursos de una sección (PDF, Word, Excel, PowerPoint,
// imágenes o texto — ver lib/resourceTypes.ts); separado para no repetir el
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
    <div className="mt-2 border-t border-brand-50 pt-2">
      <input
        ref={inputRef}
        type="file"
        accept={RESOURCE_UPLOAD_ACCEPT}
        onChange={onFileSelected}
        disabled={uploadMutation.isPending}
        className="text-sm"
      />
      {uploadMutation.isPending && <p className="text-xs text-slate-500">Subiendo…</p>}
      {uploadMutation.isError && <ErrorState error={uploadMutation.error} />}
    </div>
  );
}
