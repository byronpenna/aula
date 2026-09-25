import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { apiClient } from "../lib/apiClient";
import type {
  AcademicYear,
  Course,
  EnrollmentRecord,
  GradeLevel,
  Permissions,
  Section,
  StudentProfile,
  Subject,
  Teacher,
} from "../lib/types";
import { ErrorState, ForbiddenState, LoadingState } from "../components/States";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { StatusBadge } from "../components/StatusBadge";

// Panel de administración académica: pestañas horizontales dentro de un mismo
// módulo (aula_virtual_linares_agente_v2/02-PANTALLAS-Y-FLUJOS.md §1: "la
// navegación de «Academia» puede contar también con pestañas horizontales dentro
// del módulo... sin duplicar botones de creación"). El estado de la pestaña activa
// vive en el query param `tab` para que el dashboard pueda enlazar directo a una.
type TabKey = "years" | "grades" | "subjects" | "sections" | "courses" | "enrollments";

const TABS: { key: TabKey; label: string }[] = [
  { key: "years", label: "Años académicos" },
  { key: "grades", label: "Grados" },
  { key: "subjects", label: "Materias" },
  { key: "sections", label: "Secciones" },
  { key: "courses", label: "Cursos" },
  { key: "enrollments", label: "Inscripciones" },
];

export function AcademicsAdminPage() {
  const { data: permissions, isLoading, error } = useQuery<Permissions>({
    queryKey: ["me", "permissions"],
    queryFn: async () => (await apiClient.get("/me/permissions")).data,
  });
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get("tab") as TabKey | null) ?? "years";

  if (isLoading) return <LoadingState label="Cargando…" />;
  if (error) return <ErrorState error={error} />;
  if (!permissions?.permissions.includes("academics:manage")) {
    return (
      <ForbiddenState message="Solo administración escolar o coordinación pueden gestionar la estructura académica." />
    );
  }

  return (
    <div className="space-y-4">
      <Breadcrumbs items={[{ label: "Administración", to: "/admin" }, { label: "Academia" }]} />
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-900">Academia</h1>
        <p className="text-sm text-brand-700">
          Gestiona años académicos, grados, materias, secciones, cursos e inscripciones.
        </p>
      </div>

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

      {tab === "years" && <AcademicYearsSection />}
      {tab === "grades" && <GradeLevelsSection />}
      {tab === "subjects" && <SubjectsSection />}
      {tab === "sections" && <SectionsSection />}
      {tab === "courses" && <CoursesSection />}
      {tab === "enrollments" && <EnrollmentsSection />}
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-brand-100 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-brand-900">{title}</h2>
      {children}
    </section>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      {children}
      {error && <p className="mt-0.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}

const inputClass = "focus-ring w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm";
const th = "px-2 py-1.5 text-left text-xs font-medium text-brand-700";
const td = "px-2 py-1.5 text-sm text-slate-700";
const rowActionBtn =
  "focus-ring rounded-md border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-100";

function ArchiveActivateButtons({
  status,
  onArchive,
  onActivate,
  disabled,
}: {
  status: string;
  onArchive: () => void;
  onActivate: () => void;
  disabled?: boolean;
}) {
  return status === "archived" ? (
    <button type="button" onClick={onActivate} disabled={disabled} className={rowActionBtn}>
      Reactivar
    </button>
  ) : (
    <button type="button" onClick={onArchive} disabled={disabled} className={rowActionBtn}>
      Archivar
    </button>
  );
}

// --- Años académicos ---------------------------------------------------

const yearSchema = z
  .object({
    label: z.string().min(1, "Requerido."),
    starts_on: z.string().min(1, "Requerido."),
    ends_on: z.string().min(1, "Requerido."),
  })
  .refine((v) => v.ends_on > v.starts_on, {
    message: "Debe ser posterior al inicio.",
    path: ["ends_on"],
  });
type YearForm = z.infer<typeof yearSchema>;

function AcademicYearsSection() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery<AcademicYear[]>({
    queryKey: ["academic-years"],
    queryFn: async () => (await apiClient.get("/academic-years")).data,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<YearForm>({ resolver: zodResolver(yearSchema) });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["academic-years"] });

  const createMutation = useMutation({
    mutationFn: async (values: YearForm) => (await apiClient.post("/academic-years", values)).data,
    onSuccess: () => {
      invalidate();
      reset();
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "archive" | "activate" }) =>
      (await apiClient.post(`/academic-years/${id}/${action}`)).data,
    onSuccess: invalidate,
  });

  return (
    <Card title="Años académicos">
      <form
        onSubmit={handleSubmit((values) => createMutation.mutate(values))}
        className="grid gap-3 sm:grid-cols-4"
        noValidate
      >
        <Field label="Etiqueta (ej. 2027)" error={errors.label?.message}>
          <input className={inputClass} {...register("label")} />
        </Field>
        <Field label="Inicio" error={errors.starts_on?.message}>
          <input type="date" className={inputClass} {...register("starts_on")} />
        </Field>
        <Field label="Fin" error={errors.ends_on?.message}>
          <input type="date" className={inputClass} {...register("ends_on")} />
        </Field>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="focus-ring w-full rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            Crear
          </button>
        </div>
      </form>
      {createMutation.isError && <ErrorState error={createMutation.error} />}

      {isLoading && <LoadingState label="Cargando años…" />}
      {error && <ErrorState error={error} />}
      {data && data.length === 0 && <p className="mt-3 text-sm text-slate-500">Sin años todavía.</p>}
      {data && data.length > 0 && (
        <div className="overflow-x-auto">
        <table className="mt-3 w-full border-collapse">
          <thead>
            <tr className="border-b border-brand-100">
              <th className={th}>Etiqueta</th>
              <th className={th}>Inicio</th>
              <th className={th}>Fin</th>
              <th className={th}>Estado</th>
              <th className={th}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {data.map((year) =>
              editingId === year.id ? (
                <YearEditRow
                  key={year.id}
                  year={year}
                  onCancel={() => setEditingId(null)}
                  onSaved={() => {
                    invalidate();
                    setEditingId(null);
                  }}
                />
              ) : (
                <tr key={year.id} className="border-b border-slate-100">
                  <td className={td}>{year.label}</td>
                  <td className={td}>{year.starts_on}</td>
                  <td className={td}>{year.ends_on}</td>
                  <td className={td}>
                    <StatusBadge status={year.status} />
                  </td>
                  <td className={`${td} space-x-2`}>
                    <button
                      type="button"
                      onClick={() => setEditingId(year.id)}
                      className={rowActionBtn}
                    >
                      Editar
                    </button>
                    <ArchiveActivateButtons
                      status={year.status}
                      disabled={statusMutation.isPending}
                      onArchive={() => statusMutation.mutate({ id: year.id, action: "archive" })}
                      onActivate={() => statusMutation.mutate({ id: year.id, action: "activate" })}
                    />
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
        </div>
      )}
      {statusMutation.isError && <ErrorState error={statusMutation.error} />}
    </Card>
  );
}

function YearEditRow({
  year,
  onCancel,
  onSaved,
}: {
  year: AcademicYear;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<YearForm>({
    resolver: zodResolver(yearSchema),
    defaultValues: { label: year.label, starts_on: year.starts_on, ends_on: year.ends_on },
  });
  const mutation = useMutation({
    mutationFn: async (values: YearForm) =>
      (await apiClient.patch(`/academic-years/${year.id}`, values)).data,
    onSuccess: onSaved,
  });

  return (
    <tr className="border-b border-slate-100 bg-brand-50/40">
      <td colSpan={5} className="p-2">
        <form
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="grid gap-2 sm:grid-cols-4"
          noValidate
        >
          <Field label="Etiqueta" error={errors.label?.message}>
            <input className={inputClass} {...register("label")} />
          </Field>
          <Field label="Inicio" error={errors.starts_on?.message}>
            <input type="date" className={inputClass} {...register("starts_on")} />
          </Field>
          <Field label="Fin" error={errors.ends_on?.message}>
            <input type="date" className={inputClass} {...register("ends_on")} />
          </Field>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="focus-ring rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              Guardar
            </button>
            <button type="button" onClick={onCancel} className={rowActionBtn}>
              Cancelar
            </button>
          </div>
          {mutation.isError && (
            <div className="sm:col-span-4">
              <ErrorState error={mutation.error} />
            </div>
          )}
        </form>
      </td>
    </tr>
  );
}

// --- Grados --------------------------------------------------------------

// sort_order se mantiene como string en el formulario y se convierte a número solo
// al enviar (mismo motivo que max_score en CourseDetailPage.tsx: evita el desajuste
// de tipos input/output de z.transform con el resolver de react-hook-form).
const gradeSchema = z.object({
  name: z.string().min(1, "Requerido."),
  sort_order: z.string().min(1, "Requerido."),
});
type GradeForm = z.infer<typeof gradeSchema>;

function GradeLevelsSection() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery<GradeLevel[]>({
    queryKey: ["grade-levels"],
    queryFn: async () => (await apiClient.get("/grade-levels")).data,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<GradeForm>({ resolver: zodResolver(gradeSchema), defaultValues: { sort_order: "1" } });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["grade-levels"] });

  const createMutation = useMutation({
    mutationFn: async (values: GradeForm) =>
      (
        await apiClient.post("/grade-levels", {
          name: values.name,
          sort_order: Number(values.sort_order),
        })
      ).data,
    onSuccess: () => {
      invalidate();
      reset();
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "archive" | "activate" }) =>
      (await apiClient.post(`/grade-levels/${id}/${action}`)).data,
    onSuccess: invalidate,
  });

  return (
    <Card title="Grados">
      <form
        onSubmit={handleSubmit((values) => createMutation.mutate(values))}
        className="grid gap-3 sm:grid-cols-4"
        noValidate
      >
        <Field label="Nombre (ej. Sexto grado)" error={errors.name?.message}>
          <input className={inputClass} {...register("name")} />
        </Field>
        <Field label="Orden" error={errors.sort_order?.message}>
          <input type="number" min={1} className={inputClass} {...register("sort_order")} />
        </Field>
        <div className="flex items-end sm:col-span-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="focus-ring rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            Crear
          </button>
        </div>
      </form>
      {createMutation.isError && <ErrorState error={createMutation.error} />}

      {isLoading && <LoadingState label="Cargando grados…" />}
      {error && <ErrorState error={error} />}
      {data && data.length === 0 && <p className="mt-3 text-sm text-slate-500">Sin grados todavía.</p>}
      {data && data.length > 0 && (
        <div className="overflow-x-auto">
        <table className="mt-3 w-full border-collapse">
          <thead>
            <tr className="border-b border-brand-100">
              <th className={th}>Nombre</th>
              <th className={th}>Orden</th>
              <th className={th}>Estado</th>
              <th className={th}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {data
              .slice()
              .sort((a, b) => a.sort_order - b.sort_order)
              .map((grade) =>
                editingId === grade.id ? (
                  <GradeEditRow
                    key={grade.id}
                    grade={grade}
                    onCancel={() => setEditingId(null)}
                    onSaved={() => {
                      invalidate();
                      setEditingId(null);
                    }}
                  />
                ) : (
                  <tr key={grade.id} className="border-b border-slate-100">
                    <td className={td}>{grade.name}</td>
                    <td className={td}>{grade.sort_order}</td>
                    <td className={td}>
                      <StatusBadge status={grade.status} />
                    </td>
                    <td className={`${td} space-x-2`}>
                      <button
                        type="button"
                        onClick={() => setEditingId(grade.id)}
                        className={rowActionBtn}
                      >
                        Editar
                      </button>
                      <ArchiveActivateButtons
                        status={grade.status}
                        disabled={statusMutation.isPending}
                        onArchive={() => statusMutation.mutate({ id: grade.id, action: "archive" })}
                        onActivate={() =>
                          statusMutation.mutate({ id: grade.id, action: "activate" })
                        }
                      />
                    </td>
                  </tr>
                ),
              )}
          </tbody>
        </table>
        </div>
      )}
      {statusMutation.isError && <ErrorState error={statusMutation.error} />}
    </Card>
  );
}

function GradeEditRow({
  grade,
  onCancel,
  onSaved,
}: {
  grade: GradeLevel;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<GradeForm>({
    resolver: zodResolver(gradeSchema),
    defaultValues: { name: grade.name, sort_order: String(grade.sort_order) },
  });
  const mutation = useMutation({
    mutationFn: async (values: GradeForm) =>
      (
        await apiClient.patch(`/grade-levels/${grade.id}`, {
          name: values.name,
          sort_order: Number(values.sort_order),
        })
      ).data,
    onSuccess: onSaved,
  });

  return (
    <tr className="border-b border-slate-100 bg-brand-50/40">
      <td colSpan={4} className="p-2">
        <form
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="grid gap-2 sm:grid-cols-4"
          noValidate
        >
          <Field label="Nombre" error={errors.name?.message}>
            <input className={inputClass} {...register("name")} />
          </Field>
          <Field label="Orden" error={errors.sort_order?.message}>
            <input type="number" min={1} className={inputClass} {...register("sort_order")} />
          </Field>
          <div className="flex items-end gap-2 sm:col-span-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="focus-ring rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              Guardar
            </button>
            <button type="button" onClick={onCancel} className={rowActionBtn}>
              Cancelar
            </button>
          </div>
          {mutation.isError && (
            <div className="sm:col-span-4">
              <ErrorState error={mutation.error} />
            </div>
          )}
        </form>
      </td>
    </tr>
  );
}

// --- Materias --------------------------------------------------------------

const subjectSchema = z.object({
  code: z.string().min(1, "Requerido."),
  name: z.string().min(1, "Requerido."),
});
type SubjectForm = z.infer<typeof subjectSchema>;

function SubjectsSection() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery<Subject[]>({
    queryKey: ["subjects"],
    queryFn: async () => (await apiClient.get("/subjects")).data,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SubjectForm>({ resolver: zodResolver(subjectSchema) });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["subjects"] });

  const createMutation = useMutation({
    mutationFn: async (values: SubjectForm) => (await apiClient.post("/subjects", values)).data,
    onSuccess: () => {
      invalidate();
      reset();
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "archive" | "activate" }) =>
      (await apiClient.post(`/subjects/${id}/${action}`)).data,
    onSuccess: invalidate,
  });

  return (
    <Card title="Materias">
      <form
        onSubmit={handleSubmit((values) => createMutation.mutate(values))}
        className="grid gap-3 sm:grid-cols-4"
        noValidate
      >
        <Field label="Código (ej. MAT6)" error={errors.code?.message}>
          <input className={inputClass} {...register("code")} />
        </Field>
        <Field label="Nombre (ej. Matemática)" error={errors.name?.message}>
          <input className={inputClass} {...register("name")} />
        </Field>
        <div className="flex items-end sm:col-span-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="focus-ring rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            Crear
          </button>
        </div>
      </form>
      {createMutation.isError && <ErrorState error={createMutation.error} />}

      {isLoading && <LoadingState label="Cargando materias…" />}
      {error && <ErrorState error={error} />}
      {data && data.length === 0 && (
        <p className="mt-3 text-sm text-slate-500">Sin materias todavía.</p>
      )}
      {data && data.length > 0 && (
        <div className="overflow-x-auto">
        <table className="mt-3 w-full border-collapse">
          <thead>
            <tr className="border-b border-brand-100">
              <th className={th}>Código</th>
              <th className={th}>Nombre</th>
              <th className={th}>Estado</th>
              <th className={th}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {data.map((subject) =>
              editingId === subject.id ? (
                <SubjectEditRow
                  key={subject.id}
                  subject={subject}
                  onCancel={() => setEditingId(null)}
                  onSaved={() => {
                    invalidate();
                    setEditingId(null);
                  }}
                />
              ) : (
                <tr key={subject.id} className="border-b border-slate-100">
                  <td className={td}>{subject.code}</td>
                  <td className={td}>{subject.name}</td>
                  <td className={td}>
                    <StatusBadge status={subject.status} />
                  </td>
                  <td className={`${td} space-x-2`}>
                    <button
                      type="button"
                      onClick={() => setEditingId(subject.id)}
                      className={rowActionBtn}
                    >
                      Editar
                    </button>
                    <ArchiveActivateButtons
                      status={subject.status}
                      disabled={statusMutation.isPending}
                      onArchive={() => statusMutation.mutate({ id: subject.id, action: "archive" })}
                      onActivate={() =>
                        statusMutation.mutate({ id: subject.id, action: "activate" })
                      }
                    />
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
        </div>
      )}
      {statusMutation.isError && <ErrorState error={statusMutation.error} />}
    </Card>
  );
}

function SubjectEditRow({
  subject,
  onCancel,
  onSaved,
}: {
  subject: Subject;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SubjectForm>({
    resolver: zodResolver(subjectSchema),
    defaultValues: { code: subject.code, name: subject.name },
  });
  const mutation = useMutation({
    mutationFn: async (values: SubjectForm) =>
      (await apiClient.patch(`/subjects/${subject.id}`, values)).data,
    onSuccess: onSaved,
  });

  return (
    <tr className="border-b border-slate-100 bg-brand-50/40">
      <td colSpan={4} className="p-2">
        <form
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="grid gap-2 sm:grid-cols-4"
          noValidate
        >
          <Field label="Código" error={errors.code?.message}>
            <input className={inputClass} {...register("code")} />
          </Field>
          <Field label="Nombre" error={errors.name?.message}>
            <input className={inputClass} {...register("name")} />
          </Field>
          <div className="flex items-end gap-2 sm:col-span-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="focus-ring rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              Guardar
            </button>
            <button type="button" onClick={onCancel} className={rowActionBtn}>
              Cancelar
            </button>
          </div>
          {mutation.isError && (
            <div className="sm:col-span-4">
              <ErrorState error={mutation.error} />
            </div>
          )}
        </form>
      </td>
    </tr>
  );
}

// --- Secciones ---------------------------------------------------------

const sectionSchema = z.object({
  academic_year_id: z.string().min(1, "Requerido."),
  grade_level_id: z.string().min(1, "Requerido."),
  name: z.string().min(1, "Requerido."),
});
type SectionForm = z.infer<typeof sectionSchema>;

function useYearsAndGrades() {
  const years = useQuery<AcademicYear[]>({
    queryKey: ["academic-years"],
    queryFn: async () => (await apiClient.get("/academic-years")).data,
  });
  const grades = useQuery<GradeLevel[]>({
    queryKey: ["grade-levels"],
    queryFn: async () => (await apiClient.get("/grade-levels")).data,
  });
  const yearLabel = (id: string) => years.data?.find((y) => y.id === id)?.label ?? id.slice(0, 8);
  const gradeName = (id: string) => grades.data?.find((g) => g.id === id)?.name ?? id.slice(0, 8);
  return { years, grades, yearLabel, gradeName };
}

function SectionsSection() {
  const queryClient = useQueryClient();
  const { years, grades, yearLabel, gradeName } = useYearsAndGrades();
  const { data, isLoading, error } = useQuery<Section[]>({
    queryKey: ["sections"],
    queryFn: async () => (await apiClient.get("/sections")).data,
  });
  const [editingId, setEditingId] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SectionForm>({ resolver: zodResolver(sectionSchema) });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["sections"] });

  const createMutation = useMutation({
    mutationFn: async (values: SectionForm) => (await apiClient.post("/sections", values)).data,
    onSuccess: () => {
      invalidate();
      reset();
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, action }: { id: string; action: "archive" | "activate" }) =>
      (await apiClient.post(`/sections/${id}/${action}`)).data,
    onSuccess: invalidate,
  });

  const canCreate = (years.data?.length ?? 0) > 0 && (grades.data?.length ?? 0) > 0;

  return (
    <Card title="Secciones">
      {!canCreate && (
        <p className="mb-3 text-xs text-slate-500">
          Crea al menos un año académico y un grado antes de agregar secciones.
        </p>
      )}
      <form
        onSubmit={handleSubmit((values) => createMutation.mutate(values))}
        className="grid gap-3 sm:grid-cols-4"
        noValidate
      >
        <Field label="Año académico" error={errors.academic_year_id?.message}>
          <select className={inputClass} {...register("academic_year_id")}>
            <option value="">Selecciona…</option>
            {years.data?.map((year) => (
              <option key={year.id} value={year.id}>
                {year.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Grado" error={errors.grade_level_id?.message}>
          <select className={inputClass} {...register("grade_level_id")}>
            <option value="">Selecciona…</option>
            {grades.data?.map((grade) => (
              <option key={grade.id} value={grade.id}>
                {grade.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Nombre (ej. A)" error={errors.name?.message}>
          <input className={inputClass} {...register("name")} />
        </Field>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={isSubmitting || !canCreate}
            className="focus-ring w-full rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            Crear
          </button>
        </div>
      </form>
      {createMutation.isError && <ErrorState error={createMutation.error} />}

      {isLoading && <LoadingState label="Cargando secciones…" />}
      {error && <ErrorState error={error} />}
      {data && data.length === 0 && (
        <p className="mt-3 text-sm text-slate-500">Sin secciones todavía.</p>
      )}
      {data && data.length > 0 && (
        <div className="overflow-x-auto">
        <table className="mt-3 w-full border-collapse">
          <thead>
            <tr className="border-b border-brand-100">
              <th className={th}>Año</th>
              <th className={th}>Grado</th>
              <th className={th}>Nombre</th>
              <th className={th}>Estado</th>
              <th className={th}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {data.map((section) =>
              editingId === section.id ? (
                <SectionEditRow
                  key={section.id}
                  section={section}
                  years={years.data ?? []}
                  grades={grades.data ?? []}
                  onCancel={() => setEditingId(null)}
                  onSaved={() => {
                    invalidate();
                    setEditingId(null);
                  }}
                />
              ) : (
                <tr key={section.id} className="border-b border-slate-100">
                  <td className={td}>{yearLabel(section.academic_year_id)}</td>
                  <td className={td}>{gradeName(section.grade_level_id)}</td>
                  <td className={td}>{section.name}</td>
                  <td className={td}>
                    <StatusBadge status={section.status} />
                  </td>
                  <td className={`${td} space-x-2`}>
                    <button
                      type="button"
                      onClick={() => setEditingId(section.id)}
                      className={rowActionBtn}
                    >
                      Editar
                    </button>
                    <ArchiveActivateButtons
                      status={section.status}
                      disabled={statusMutation.isPending}
                      onArchive={() => statusMutation.mutate({ id: section.id, action: "archive" })}
                      onActivate={() =>
                        statusMutation.mutate({ id: section.id, action: "activate" })
                      }
                    />
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
        </div>
      )}
      {statusMutation.isError && <ErrorState error={statusMutation.error} />}
    </Card>
  );
}

function SectionEditRow({
  section,
  years,
  grades,
  onCancel,
  onSaved,
}: {
  section: Section;
  years: AcademicYear[];
  grades: GradeLevel[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SectionForm>({
    resolver: zodResolver(sectionSchema),
    defaultValues: {
      academic_year_id: section.academic_year_id,
      grade_level_id: section.grade_level_id,
      name: section.name,
    },
  });
  const mutation = useMutation({
    mutationFn: async (values: SectionForm) =>
      (await apiClient.patch(`/sections/${section.id}`, values)).data,
    onSuccess: onSaved,
  });

  return (
    <tr className="border-b border-slate-100 bg-brand-50/40">
      <td colSpan={5} className="p-2">
        <form
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
          className="grid gap-2 sm:grid-cols-4"
          noValidate
        >
          <Field label="Año académico" error={errors.academic_year_id?.message}>
            <select className={inputClass} {...register("academic_year_id")}>
              {years.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Grado" error={errors.grade_level_id?.message}>
            <select className={inputClass} {...register("grade_level_id")}>
              {grades.map((grade) => (
                <option key={grade.id} value={grade.id}>
                  {grade.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Nombre" error={errors.name?.message}>
            <input className={inputClass} {...register("name")} />
          </Field>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="focus-ring rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              Guardar
            </button>
            <button type="button" onClick={onCancel} className={rowActionBtn}>
              Cancelar
            </button>
          </div>
          {mutation.isError && (
            <div className="sm:col-span-4">
              <ErrorState error={mutation.error} />
            </div>
          )}
        </form>
      </td>
    </tr>
  );
}

// --- Cursos --------------------------------------------------------------
// Solo quien administra la estructura académica (school_admin/coordinator, ver
// `academics:manage` en AcademicsAdminPage) llega a esta sección: crea, edita y
// archiva cursos (baja lógica en el backend, reversible con "Reactivar"), y debe
// asignar un docente encargado antes de que EnrollmentsSection permita matricular
// alumnos en ese curso. Un curso archivado sigue siendo accesible por su ID
// (historial de tareas/entregas), solo desaparece de este listado.

const courseSchema = z
  .object({
    academic_year_id: z.string().min(1, "Requerido."),
    section_id: z.string().min(1, "Requerido."),
    subject_id: z.string().min(1, "Requerido."),
    starts_on: z.string().min(1, "Requerido."),
    ends_on: z.string().min(1, "Requerido."),
  })
  .refine((v) => v.ends_on > v.starts_on, {
    message: "Debe ser posterior a la fecha de inicio.",
    path: ["ends_on"],
  });
type CourseForm = z.infer<typeof courseSchema>;

const courseEditSchema = z
  .object({
    starts_on: z.string().min(1, "Requerido."),
    ends_on: z.string().min(1, "Requerido."),
  })
  .refine((v) => v.ends_on > v.starts_on, {
    message: "Debe ser posterior a la fecha de inicio.",
    path: ["ends_on"],
  });
type CourseEditForm = z.infer<typeof courseEditSchema>;

function useCoursesQueryData() {
  const { years, grades, yearLabel } = useYearsAndGrades();
  const sections = useQuery<Section[]>({
    queryKey: ["sections"],
    queryFn: async () => (await apiClient.get("/sections")).data,
  });
  const subjects = useQuery<Subject[]>({
    queryKey: ["subjects"],
    queryFn: async () => (await apiClient.get("/subjects")).data,
  });
  const teachers = useQuery<Teacher[]>({
    queryKey: ["teachers"],
    queryFn: async () => (await apiClient.get("/teachers")).data,
  });

  const subjectName = (id: string) => subjects.data?.find((s) => s.id === id)?.name ?? id.slice(0, 8);
  const sectionLabel = (id: string) => {
    const section = sections.data?.find((s) => s.id === id);
    if (!section) return id.slice(0, 8);
    const grade = grades.data?.find((g) => g.id === section.grade_level_id)?.name ?? "";
    return `${grade} "${section.name}"`.trim();
  };
  const teacherName = (id: string) =>
    teachers.data?.find((t) => t.id === id)?.display_name ?? id.slice(0, 8);

  return { years, sections, grades, subjects, teachers, yearLabel, subjectName, sectionLabel, teacherName };
}

function CoursesSection() {
  const queryClient = useQueryClient();
  const { years, sections, subjects, teachers, yearLabel, subjectName, sectionLabel, teacherName } =
    useCoursesQueryData();
  const { data, isLoading, error } = useQuery<Course[]>({
    queryKey: ["courses"],
    queryFn: async () => (await apiClient.get("/courses")).data,
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CourseForm>({ resolver: zodResolver(courseSchema) });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["courses"] });

  const createMutation = useMutation({
    mutationFn: async (values: CourseForm) => (await apiClient.post("/courses", values)).data,
    onSuccess: () => {
      invalidate();
      reset();
    },
  });

  const canCreate =
    (years.data?.length ?? 0) > 0 && (sections.data?.length ?? 0) > 0 && (subjects.data?.length ?? 0) > 0;

  return (
    <Card title="Cursos">
      {!canCreate && (
        <p className="mb-3 text-xs text-slate-500">
          Crea al menos un año académico, una sección y una materia antes de agregar cursos.
        </p>
      )}
      <form
        onSubmit={handleSubmit((values) => createMutation.mutate(values))}
        className="grid gap-3 sm:grid-cols-3"
        noValidate
      >
        <Field label="Año académico" error={errors.academic_year_id?.message}>
          <select className={inputClass} {...register("academic_year_id")}>
            <option value="">Selecciona…</option>
            {years.data?.map((year) => (
              <option key={year.id} value={year.id}>
                {year.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Sección" error={errors.section_id?.message}>
          <select className={inputClass} {...register("section_id")}>
            <option value="">Selecciona…</option>
            {sections.data?.map((section) => (
              <option key={section.id} value={section.id}>
                {sectionLabel(section.id)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Materia" error={errors.subject_id?.message}>
          <select className={inputClass} {...register("subject_id")}>
            <option value="">Selecciona…</option>
            {subjects.data?.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Fecha de inicio" error={errors.starts_on?.message}>
          <input type="date" className={inputClass} {...register("starts_on")} />
        </Field>
        <Field label="Fecha de fin" error={errors.ends_on?.message}>
          <input type="date" className={inputClass} {...register("ends_on")} />
        </Field>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={isSubmitting || !canCreate}
            className="focus-ring w-full rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            Crear
          </button>
        </div>
      </form>
      {createMutation.isError && <ErrorState error={createMutation.error} />}

      {isLoading && <LoadingState label="Cargando cursos…" />}
      {error && <ErrorState error={error} />}
      {data && data.length === 0 && (
        <p className="mt-3 text-sm text-slate-500">Sin cursos todavía.</p>
      )}
      {data && data.length > 0 && (
        <div className="overflow-x-auto">
        <table className="mt-3 w-full border-collapse">
          <thead>
            <tr className="border-b border-brand-100">
              <th className={th}>Materia</th>
              <th className={th}>Sección</th>
              <th className={th}>Año</th>
              <th className={th}>Docente</th>
              <th className={th}>Inicio</th>
              <th className={th}>Fin</th>
              <th className={th}>Estado</th>
              <th className={th}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {data.map((course) => (
              <CourseRows
                key={course.id}
                course={course}
                teachers={teachers.data ?? []}
                subjectName={subjectName}
                sectionLabel={sectionLabel}
                yearLabel={yearLabel}
                teacherName={teacherName}
                expanded={expandedId === course.id}
                onToggleExpanded={() =>
                  setExpandedId((id) => (id === course.id ? null : course.id))
                }
              />
            ))}
          </tbody>
        </table>
        </div>
      )}
    </Card>
  );
}

function CourseRows({
  course,
  teachers,
  subjectName,
  sectionLabel,
  yearLabel,
  teacherName,
  expanded,
  onToggleExpanded,
}: {
  course: Course;
  teachers: Teacher[];
  subjectName: (id: string) => string;
  sectionLabel: (id: string) => string;
  yearLabel: (id: string) => string;
  teacherName: (id: string) => string;
  expanded: boolean;
  onToggleExpanded: () => void;
}) {
  const queryClient = useQueryClient();
  const [teacherToAssign, setTeacherToAssign] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CourseEditForm>({
    resolver: zodResolver(courseEditSchema),
    defaultValues: { starts_on: course.starts_on, ends_on: course.ends_on },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["courses"] });

  const updateMutation = useMutation({
    mutationFn: async (values: CourseEditForm) =>
      (await apiClient.patch(`/courses/${course.id}`, values)).data,
    onSuccess: invalidate,
  });

  const statusMutation = useMutation({
    mutationFn: async (action: "archive" | "activate") =>
      (await apiClient.post(`/courses/${course.id}/${action}`)).data,
    onSuccess: invalidate,
  });

  const assignTeacherMutation = useMutation({
    mutationFn: async (teacherId: string) =>
      (await apiClient.post(`/courses/${course.id}/teachers`, { teacher_user_id: teacherId })).data,
    onSuccess: () => {
      invalidate();
      setTeacherToAssign("");
    },
  });

  const availableTeachers = teachers.filter((t) => !course.teacher_user_ids.includes(t.id));

  return (
    <>
      <tr className="border-b border-slate-100">
        <td className={td}>{subjectName(course.subject_id)}</td>
        <td className={td}>{sectionLabel(course.section_id)}</td>
        <td className={td}>{yearLabel(course.academic_year_id)}</td>
        <td className={td}>
          {course.teacher_user_ids.length > 0 ? (
            course.teacher_user_ids.map(teacherName).join(", ")
          ) : (
            <span className="text-amber-700">Sin asignar</span>
          )}
        </td>
        <td className={td}>{course.starts_on}</td>
        <td className={td}>{course.ends_on}</td>
        <td className={td}>
          <StatusBadge status={course.status} />
        </td>
        <td className={`${td} space-x-2 whitespace-nowrap`}>
          <button type="button" onClick={onToggleExpanded} className={rowActionBtn}>
            {expanded ? "Cerrar" : "Gestionar"}
          </button>
          <ArchiveActivateButtons
            status={course.status}
            disabled={statusMutation.isPending}
            onArchive={() => statusMutation.mutate("archive")}
            onActivate={() => statusMutation.mutate("activate")}
          />
        </td>
      </tr>
      {expanded && (
        <tr className="border-b border-slate-100 bg-brand-50/40">
          <td colSpan={8} className="space-y-3 p-3">
            <form
              onSubmit={handleSubmit((values) => updateMutation.mutate(values))}
              className="grid gap-2 sm:grid-cols-3"
              noValidate
            >
              <Field label="Fecha de inicio" error={errors.starts_on?.message}>
                <input type="date" className={inputClass} {...register("starts_on")} />
              </Field>
              <Field label="Fecha de fin" error={errors.ends_on?.message}>
                <input type="date" className={inputClass} {...register("ends_on")} />
              </Field>
              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="focus-ring w-full rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  Guardar fechas
                </button>
              </div>
              {updateMutation.isError && (
                <div className="sm:col-span-3">
                  <ErrorState error={updateMutation.error} />
                </div>
              )}
            </form>

            <div className="border-t border-brand-100 pt-2">
              <p className="mb-1 text-xs font-medium text-brand-700">
                Asignar / cambiar docente encargado
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className={inputClass + " max-w-xs"}
                  value={teacherToAssign}
                  onChange={(e) => setTeacherToAssign(e.target.value)}
                >
                  <option value="">Selecciona un docente…</option>
                  {availableTeachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.display_name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={!teacherToAssign || assignTeacherMutation.isPending}
                  onClick={() => assignTeacherMutation.mutate(teacherToAssign)}
                  className={`${rowActionBtn} disabled:opacity-60`}
                >
                  Asignar
                </button>
              </div>
              {assignTeacherMutation.isError && <ErrorState error={assignTeacherMutation.error} />}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// --- Inscripciones -------------------------------------------------------

const enrollmentSchema = z.object({
  student_id: z.string().min(1, "Requerido."),
  academic_year_id: z.string().min(1, "Requerido."),
  section_id: z.string().min(1, "Requerido."),
  starts_on: z.string().min(1, "Requerido."),
});
type EnrollmentForm = z.infer<typeof enrollmentSchema>;

function EnrollmentsSection() {
  const queryClient = useQueryClient();
  const [selectedCourseIds, setSelectedCourseIds] = useState<string[]>([]);
  const { years, yearLabel, gradeName } = useYearsAndGrades();

  const students = useQuery<StudentProfile[]>({
    queryKey: ["students"],
    queryFn: async () => (await apiClient.get("/students")).data,
  });
  const sections = useQuery<Section[]>({
    queryKey: ["sections"],
    queryFn: async () => (await apiClient.get("/sections")).data,
  });
  const courses = useQuery<Course[]>({
    queryKey: ["courses"],
    queryFn: async () => (await apiClient.get("/courses")).data,
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<EnrollmentForm>({ resolver: zodResolver(enrollmentSchema) });

  const selectedSectionId = watch("section_id");
  const selectedStudentId = watch("student_id");
  const coursesInSection = courses.data?.filter((c) => c.section_id === selectedSectionId) ?? [];

  const studentEnrollments = useQuery<EnrollmentRecord[]>({
    queryKey: ["students", selectedStudentId, "enrollments"],
    queryFn: async () => (await apiClient.get(`/students/${selectedStudentId}/enrollments`)).data,
    enabled: Boolean(selectedStudentId),
  });

  const createMutation = useMutation({
    mutationFn: async (values: EnrollmentForm) =>
      (
        await apiClient.post("/enrollments", {
          ...values,
          course_ids: selectedCourseIds,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students", selectedStudentId, "enrollments"] });
      reset();
      setSelectedCourseIds([]);
    },
  });

  function toggleCourse(courseId: string) {
    setSelectedCourseIds((ids) =>
      ids.includes(courseId) ? ids.filter((id) => id !== courseId) : [...ids, courseId],
    );
  }

  const studentLabel = (student: StudentProfile) =>
    student.display_name
      ? `${student.display_name} (${student.student_number})`
      : student.student_number;
  const sectionLabel = (id: string) => {
    const section = sections.data?.find((s) => s.id === id);
    if (!section) return id.slice(0, 8);
    return `${gradeName(section.grade_level_id)} "${section.name}"`.trim();
  };

  const canCreate =
    (students.data?.length ?? 0) > 0 &&
    (years.data?.length ?? 0) > 0 &&
    (sections.data?.length ?? 0) > 0;

  const selectedStudent = students.data?.find((s) => s.id === selectedStudentId);

  return (
    <Card title="Inscripciones">
      {!canCreate && (
        <p className="mb-3 text-xs text-slate-500">
          Crea al menos un alumno (vía seed/API), un año académico y una sección antes de
          matricular.
        </p>
      )}
      <form
        onSubmit={handleSubmit((values) => createMutation.mutate(values))}
        className="grid gap-3 sm:grid-cols-4"
        noValidate
      >
        <Field label="Alumno" error={errors.student_id?.message}>
          <select className={inputClass} {...register("student_id")}>
            <option value="">Selecciona…</option>
            {students.data?.map((student) => (
              <option key={student.id} value={student.id}>
                {studentLabel(student)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Año académico" error={errors.academic_year_id?.message}>
          <select className={inputClass} {...register("academic_year_id")}>
            <option value="">Selecciona…</option>
            {years.data?.map((year) => (
              <option key={year.id} value={year.id}>
                {year.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Sección" error={errors.section_id?.message}>
          <select className={inputClass} {...register("section_id")}>
            <option value="">Selecciona…</option>
            {sections.data?.map((section) => (
              <option key={section.id} value={section.id}>
                {sectionLabel(section.id)}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Fecha de inicio" error={errors.starts_on?.message}>
          <input type="date" className={inputClass} {...register("starts_on")} />
        </Field>

        {selectedSectionId && (
          <div className="sm:col-span-4">
            <p className="mb-1 text-xs font-medium text-slate-600">
              Cursos de esa sección en los que también matricular (opcional)
            </p>
            {coursesInSection.length === 0 ? (
              <p className="text-xs text-slate-500">Esa sección todavía no tiene cursos.</p>
            ) : (
              <div className="flex flex-wrap gap-3">
                {coursesInSection.map((course) => {
                  const hasTeacher = course.teacher_user_ids.length > 0;
                  return (
                    <label
                      key={course.id}
                      className={`flex items-center gap-1.5 text-xs ${
                        hasTeacher ? "text-slate-700" : "cursor-not-allowed text-slate-400"
                      }`}
                      title={
                        hasTeacher
                          ? undefined
                          : "Asigna un docente encargado a este curso antes de matricular alumnos."
                      }
                    >
                      <input
                        type="checkbox"
                        disabled={!hasTeacher}
                        checked={selectedCourseIds.includes(course.id)}
                        onChange={() => toggleCourse(course.id)}
                      />
                      Curso {course.id.slice(0, 8)}
                      {!hasTeacher && " (sin docente)"}
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="flex items-end">
          <button
            type="submit"
            disabled={isSubmitting || !canCreate}
            className="focus-ring w-full rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            Matricular
          </button>
        </div>
      </form>
      {createMutation.isError && <ErrorState error={createMutation.error} />}

      {selectedStudentId && selectedStudent && (
        <div className="mt-4 border-t border-brand-100 pt-3">
          <p className="mb-1 text-xs font-medium text-brand-700">
            Matrículas actuales de {studentLabel(selectedStudent)}
          </p>
          {studentEnrollments.isLoading && <LoadingState label="Cargando matrículas…" />}
          {studentEnrollments.error && <ErrorState error={studentEnrollments.error} />}
          {studentEnrollments.data && studentEnrollments.data.length === 0 && (
            <p className="text-xs text-slate-500">Sin matrículas todavía.</p>
          )}
          {studentEnrollments.data && studentEnrollments.data.length > 0 && (
            <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-brand-100">
                  <th className={th}>Sección</th>
                  <th className={th}>Año</th>
                  <th className={th}>Inicio</th>
                  <th className={th}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {studentEnrollments.data.map((enrollment) => (
                  <tr key={enrollment.id} className="border-b border-slate-100">
                    <td className={td}>{sectionLabel(enrollment.section_id)}</td>
                    <td className={td}>{yearLabel(enrollment.academic_year_id)}</td>
                    <td className={td}>{enrollment.starts_on}</td>
                    <td className={td}>
                      <StatusBadge status={enrollment.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
