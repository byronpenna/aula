import { type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/apiClient";
import type { AcademicYear, Course, GradeLevel, Permissions, Section, Subject } from "../lib/types";
import { ErrorState, ForbiddenState, LoadingState } from "../components/States";

// Panel de administración académica (Fase 2, sección 20): año académico, grado,
// materia, sección y curso. Los endpoints ya existían y funcionaban (verificado
// por curl); lo que faltaba era esta UI — antes solo se podía crear vía API.
export function AcademicsAdminPage() {
  const { data: permissions, isLoading, error } = useQuery<Permissions>({
    queryKey: ["me", "permissions"],
    queryFn: async () => (await apiClient.get("/me/permissions")).data,
  });

  if (isLoading) return <LoadingState label="Cargando…" />;
  if (error) return <ErrorState error={error} />;
  if (!permissions?.permissions.includes("academics:manage")) {
    return (
      <ForbiddenState message="Solo administración escolar o coordinación pueden gestionar la estructura académica." />
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold">Administración académica</h1>
      <AcademicYearsSection />
      <GradeLevelsSection />
      <SubjectsSection />
      <SectionsSection />
      <CoursesSection />
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-slate-800">{title}</h2>
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

// --- Años académicos ---------------------------------------------------

const yearSchema = z.object({
  label: z.string().min(1, "Requerido."),
  starts_on: z.string().min(1, "Requerido."),
  ends_on: z.string().min(1, "Requerido."),
});
type YearForm = z.infer<typeof yearSchema>;

function AcademicYearsSection() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery<AcademicYear[]>({
    queryKey: ["academic-years"],
    queryFn: async () => (await apiClient.get("/academic-years")).data,
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<YearForm>({ resolver: zodResolver(yearSchema) });

  const createMutation = useMutation({
    mutationFn: async (values: YearForm) => (await apiClient.post("/academic-years", values)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["academic-years"] });
      reset();
    },
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
            className="focus-ring w-full rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
          >
            Crear
          </button>
        </div>
      </form>
      {createMutation.isError && <ErrorState error={createMutation.error} />}

      {isLoading && <LoadingState label="Cargando años…" />}
      {error && <ErrorState error={error} />}
      {data && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {data.map((year) => (
            <li key={year.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
              {year.label} · {year.starts_on} → {year.ends_on}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// --- Grados --------------------------------------------------------------

// sort_order se mantiene como string en el formulario y se convierte a número solo
// al enviar (mismo motivo que max_score en CourseDetailPage.tsx: evita el desajuste
// de tipos input/output de z.transform con el resolver de react-hook-form).
const gradeSchema = z.object({
  name: z.string().min(1, "Requerido."),
  sort_order: z.string().optional(),
});
type GradeForm = z.infer<typeof gradeSchema>;

function GradeLevelsSection() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery<GradeLevel[]>({
    queryKey: ["grade-levels"],
    queryFn: async () => (await apiClient.get("/grade-levels")).data,
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<GradeForm>({ resolver: zodResolver(gradeSchema) });

  const createMutation = useMutation({
    mutationFn: async (values: GradeForm) =>
      (
        await apiClient.post("/grade-levels", {
          name: values.name,
          sort_order: values.sort_order ? Number(values.sort_order) : 0,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["grade-levels"] });
      reset();
    },
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
        <Field label="Orden">
          <input type="number" className={inputClass} {...register("sort_order")} />
        </Field>
        <div className="flex items-end sm:col-span-2">
          <button
            type="submit"
            disabled={isSubmitting}
            className="focus-ring rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
          >
            Crear
          </button>
        </div>
      </form>
      {createMutation.isError && <ErrorState error={createMutation.error} />}

      {isLoading && <LoadingState label="Cargando grados…" />}
      {error && <ErrorState error={error} />}
      {data && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {data
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((grade) => (
              <li key={grade.id} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                {grade.name}
              </li>
            ))}
        </ul>
      )}
    </Card>
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
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SubjectForm>({ resolver: zodResolver(subjectSchema) });

  const createMutation = useMutation({
    mutationFn: async (values: SubjectForm) => (await apiClient.post("/subjects", values)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subjects"] });
      reset();
    },
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
            className="focus-ring rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
          >
            Crear
          </button>
        </div>
      </form>
      {createMutation.isError && <ErrorState error={createMutation.error} />}

      {isLoading && <LoadingState label="Cargando materias…" />}
      {error && <ErrorState error={error} />}
      {data && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {data.map((subject) => (
            <li
              key={subject.id}
              className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"
            >
              {subject.code} · {subject.name}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// --- Secciones ---------------------------------------------------------

const sectionSchema = z.object({
  academic_year_id: z.string().min(1, "Requerido."),
  grade_level_id: z.string().min(1, "Requerido."),
  name: z.string().min(1, "Requerido."),
});
type SectionForm = z.infer<typeof sectionSchema>;

function SectionsSection() {
  const queryClient = useQueryClient();
  const years = useQuery<AcademicYear[]>({
    queryKey: ["academic-years"],
    queryFn: async () => (await apiClient.get("/academic-years")).data,
  });
  const grades = useQuery<GradeLevel[]>({
    queryKey: ["grade-levels"],
    queryFn: async () => (await apiClient.get("/grade-levels")).data,
  });
  const { data, isLoading, error } = useQuery<Section[]>({
    queryKey: ["sections"],
    queryFn: async () => (await apiClient.get("/sections")).data,
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<SectionForm>({ resolver: zodResolver(sectionSchema) });

  const createMutation = useMutation({
    mutationFn: async (values: SectionForm) => (await apiClient.post("/sections", values)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sections"] });
      reset();
    },
  });

  const yearLabel = (id: string) => years.data?.find((y) => y.id === id)?.label ?? id.slice(0, 8);
  const gradeName = (id: string) => grades.data?.find((g) => g.id === id)?.name ?? id.slice(0, 8);

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
            className="focus-ring w-full rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
          >
            Crear
          </button>
        </div>
      </form>
      {createMutation.isError && <ErrorState error={createMutation.error} />}

      {isLoading && <LoadingState label="Cargando secciones…" />}
      {error && <ErrorState error={error} />}
      {data && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {data.map((section) => (
            <li
              key={section.id}
              className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"
            >
              {gradeName(section.grade_level_id)} "{section.name}" · {yearLabel(section.academic_year_id)}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

// --- Cursos --------------------------------------------------------------

const courseSchema = z.object({
  academic_year_id: z.string().min(1, "Requerido."),
  section_id: z.string().min(1, "Requerido."),
  subject_id: z.string().min(1, "Requerido."),
});
type CourseForm = z.infer<typeof courseSchema>;

function CoursesSection() {
  const queryClient = useQueryClient();
  const years = useQuery<AcademicYear[]>({
    queryKey: ["academic-years"],
    queryFn: async () => (await apiClient.get("/academic-years")).data,
  });
  const sections = useQuery<Section[]>({
    queryKey: ["sections"],
    queryFn: async () => (await apiClient.get("/sections")).data,
  });
  const grades = useQuery<GradeLevel[]>({
    queryKey: ["grade-levels"],
    queryFn: async () => (await apiClient.get("/grade-levels")).data,
  });
  const subjects = useQuery<Subject[]>({
    queryKey: ["subjects"],
    queryFn: async () => (await apiClient.get("/subjects")).data,
  });
  const { data, isLoading, error } = useQuery<Course[]>({
    queryKey: ["courses"],
    queryFn: async () => (await apiClient.get("/courses")).data,
  });
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CourseForm>({ resolver: zodResolver(courseSchema) });

  const createMutation = useMutation({
    mutationFn: async (values: CourseForm) =>
      (
        await apiClient.post("/courses", {
          section_id: values.section_id,
          subject_id: values.subject_id,
          academic_year_id: values.academic_year_id,
        })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
      reset();
    },
  });

  const yearLabel = (id: string) => years.data?.find((y) => y.id === id)?.label ?? id.slice(0, 8);
  const subjectName = (id: string) => subjects.data?.find((s) => s.id === id)?.name ?? id.slice(0, 8);
  const sectionLabel = (id: string) => {
    const section = sections.data?.find((s) => s.id === id);
    if (!section) return id.slice(0, 8);
    const grade = grades.data?.find((g) => g.id === section.grade_level_id)?.name ?? "";
    return `${grade} "${section.name}"`.trim();
  };

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
        <div className="flex items-end">
          <button
            type="submit"
            disabled={isSubmitting || !canCreate}
            className="focus-ring w-full rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
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
        <ul className="mt-3 space-y-2">
          {data.map((course) => (
            <li
              key={course.id}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700"
            >
              {subjectName(course.subject_id)} · {sectionLabel(course.section_id)} ·{" "}
              {yearLabel(course.academic_year_id)}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
