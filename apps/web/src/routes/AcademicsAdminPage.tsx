import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
      <EnrollmentsSection />
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
// Solo quien administra la estructura académica (school_admin/coordinator, ver
// `academics:manage` en AcademicsAdminPage) llega a esta sección: crea, edita y
// elimina cursos (baja lógica en el backend), y debe asignar un docente encargado
// antes de que EnrollmentsSection permita matricular alumnos en ese curso.

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
  const teachers = useQuery<Teacher[]>({
    queryKey: ["teachers"],
    queryFn: async () => (await apiClient.get("/teachers")).data,
  });

  const yearLabel = (id: string) => years.data?.find((y) => y.id === id)?.label ?? id.slice(0, 8);
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
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CourseForm>({ resolver: zodResolver(courseSchema) });

  const createMutation = useMutation({
    mutationFn: async (values: CourseForm) => (await apiClient.post("/courses", values)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses"] });
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
            <CourseRow
              key={course.id}
              course={course}
              teachers={teachers.data ?? []}
              subjectName={subjectName}
              sectionLabel={sectionLabel}
              yearLabel={yearLabel}
              teacherName={teacherName}
            />
          ))}
        </ul>
      )}
    </Card>
  );
}

function CourseRow({
  course,
  teachers,
  subjectName,
  sectionLabel,
  yearLabel,
  teacherName,
}: {
  course: Course;
  teachers: Teacher[];
  subjectName: (id: string) => string;
  sectionLabel: (id: string) => string;
  yearLabel: (id: string) => string;
  teacherName: (id: string) => string;
}) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"view" | "edit" | "confirm-delete">("view");
  const [teacherToAssign, setTeacherToAssign] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CourseEditForm>({
    resolver: zodResolver(courseEditSchema),
    defaultValues: { starts_on: course.starts_on, ends_on: course.ends_on },
  });

  const invalidateCourses = () => queryClient.invalidateQueries({ queryKey: ["courses"] });

  const updateMutation = useMutation({
    mutationFn: async (values: CourseEditForm) =>
      (await apiClient.patch(`/courses/${course.id}`, values)).data,
    onSuccess: () => {
      invalidateCourses();
      setMode("view");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => apiClient.delete(`/courses/${course.id}`),
    onSuccess: () => invalidateCourses(),
  });

  const assignTeacherMutation = useMutation({
    mutationFn: async (teacherId: string) =>
      (await apiClient.post(`/courses/${course.id}/teachers`, { teacher_user_id: teacherId })).data,
    onSuccess: () => {
      invalidateCourses();
      setTeacherToAssign("");
    },
  });

  const availableTeachers = teachers.filter((t) => !course.teacher_user_ids.includes(t.id));

  return (
    <li className="rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p>
            {subjectName(course.subject_id)} · {sectionLabel(course.section_id)} ·{" "}
            {yearLabel(course.academic_year_id)}
          </p>
          <p className="text-xs text-slate-500">
            {course.starts_on} → {course.ends_on}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMode(mode === "edit" ? "view" : "edit")}
            className="focus-ring rounded-md border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-100"
          >
            {mode === "edit" ? "Cancelar" : "Editar"}
          </button>
          {mode === "confirm-delete" ? (
            <>
              <button
                type="button"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
                className="focus-ring rounded-md bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
              >
                Confirmar
              </button>
              <button
                type="button"
                onClick={() => setMode("view")}
                className="focus-ring rounded-md border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-100"
              >
                Cancelar
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setMode("confirm-delete")}
              className="focus-ring rounded-md border border-red-300 px-2.5 py-1 text-xs text-red-700 hover:bg-red-50"
            >
              Eliminar
            </button>
          )}
        </div>
      </div>
      {deleteMutation.isError && <ErrorState error={deleteMutation.error} />}

      {mode === "edit" && (
        <form
          onSubmit={handleSubmit((values) => updateMutation.mutate(values))}
          className="mt-2 grid gap-2 border-t border-slate-100 pt-2 sm:grid-cols-3"
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
              className="focus-ring w-full rounded-md bg-sky-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-sky-700 disabled:opacity-60"
            >
              Guardar
            </button>
          </div>
          {updateMutation.isError && (
            <div className="sm:col-span-3">
              <ErrorState error={updateMutation.error} />
            </div>
          )}
        </form>
      )}

      <div className="mt-2 border-t border-slate-100 pt-2">
        <p className="text-xs font-medium text-slate-600">Docente encargado</p>
        {course.teacher_user_ids.length === 0 ? (
          <p className="text-xs text-amber-700">
            Sin docente asignado — no se puede matricular alumnos en este curso todavía.
          </p>
        ) : (
          <ul className="flex flex-wrap gap-1.5">
            {course.teacher_user_ids.map((id) => (
              <li key={id} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                {teacherName(id)}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
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
            className="focus-ring rounded-md border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-100 disabled:opacity-60"
          >
            Asignar
          </button>
        </div>
        {assignTeacherMutation.isError && <ErrorState error={assignTeacherMutation.error} />}
      </div>
    </li>
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

  const students = useQuery<StudentProfile[]>({
    queryKey: ["students"],
    queryFn: async () => (await apiClient.get("/students")).data,
  });
  const years = useQuery<AcademicYear[]>({
    queryKey: ["academic-years"],
    queryFn: async () => (await apiClient.get("/academic-years")).data,
  });
  const grades = useQuery<GradeLevel[]>({
    queryKey: ["grade-levels"],
    queryFn: async () => (await apiClient.get("/grade-levels")).data,
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
    const grade = grades.data?.find((g) => g.id === section.grade_level_id)?.name ?? "";
    return `${grade} "${section.name}"`.trim();
  };
  const yearLabel = (id: string) => years.data?.find((y) => y.id === id)?.label ?? id.slice(0, 8);

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
            className="focus-ring w-full rounded-md bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-700 disabled:opacity-60"
          >
            Matricular
          </button>
        </div>
      </form>
      {createMutation.isError && <ErrorState error={createMutation.error} />}

      {selectedStudentId && selectedStudent && (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <p className="mb-1 text-xs font-medium text-slate-600">
            Matrículas actuales de {studentLabel(selectedStudent)}
          </p>
          {studentEnrollments.isLoading && <LoadingState label="Cargando matrículas…" />}
          {studentEnrollments.error && <ErrorState error={studentEnrollments.error} />}
          {studentEnrollments.data && studentEnrollments.data.length === 0 && (
            <p className="text-xs text-slate-500">Sin matrículas todavía.</p>
          )}
          {studentEnrollments.data && studentEnrollments.data.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {studentEnrollments.data.map((enrollment) => (
                <li
                  key={enrollment.id}
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700"
                >
                  {sectionLabel(enrollment.section_id)} · {yearLabel(enrollment.academic_year_id)} ·{" "}
                  {enrollment.status}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
