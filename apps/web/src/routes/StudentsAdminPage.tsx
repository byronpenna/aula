import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/apiClient";
import type {
  AcademicYear,
  EnrollmentRecord,
  GuardianLink,
  Permissions,
  Section,
  StudentProfile,
  UserListItem,
} from "../lib/types";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { EmptyState, ErrorState, ForbiddenState, LoadingState } from "../components/States";
import { StatusBadge } from "../components/StatusBadge";
import { CloseIcon } from "../components/icons";
import { StudentAvatar } from "../components/StudentAvatar";

const inputClass = "focus-ring w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm";
const th = "px-2 py-1.5 text-left text-xs font-medium text-brand-700";
const td = "px-2 py-1.5 text-sm text-slate-700";
const actionBtn = "focus-ring rounded-md border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-100";

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-brand-100 bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-brand-900">{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      {children}
      {error && <p className="mt-0.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}

// Gestión de alumnos (Administración > Alumnos): antes esto estaba repartido en
// piezas sueltas (POST /users para la cuenta, POST /students solo con número de
// alumno, nada para nombre/fecha de nacimiento/foto/tutores). Esta pantalla reúne
// todo el expediente en un solo lugar — lista + ficha, igual patrón que
// AdminUsersPage.tsx (tabla) + AcademicsAdminPage.tsx (Card/Field).
export function StudentsAdminPage() {
  const { data: permissions, isLoading, error } = useQuery<Permissions>({
    queryKey: ["me", "permissions"],
    queryFn: async () => (await apiClient.get("/me/permissions")).data,
  });

  if (isLoading) return <LoadingState label="Cargando…" />;
  if (error) return <ErrorState error={error} />;
  if (!permissions?.permissions.includes("enrollment:manage")) {
    return <ForbiddenState message="Solo administración o coordinación puede gestionar alumnos." />;
  }
  return <StudentsAdminContent canManageUsers={permissions.permissions.includes("users:manage")} />;
}

const createStudentSchema = z.object({
  student_number: z.string().min(1, "Requerido."),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  birth_date: z.string().optional(),
});
type CreateStudentForm = z.infer<typeof createStudentSchema>;

function StudentsAdminContent({ canManageUsers }: { canManageUsers: boolean }) {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const students = useQuery<StudentProfile[]>({
    queryKey: ["students"],
    queryFn: async () => (await apiClient.get("/students")).data,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateStudentForm>({ resolver: zodResolver(createStudentSchema) });

  const createMutation = useMutation({
    mutationFn: async (values: CreateStudentForm) =>
      (
        await apiClient.post<StudentProfile>("/students", {
          student_number: values.student_number,
          first_name: values.first_name || null,
          last_name: values.last_name || null,
          birth_date: values.birth_date || null,
        })
      ).data,
    onSuccess: (profile) => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      reset();
      setShowCreate(false);
      setSelectedId(profile.id);
    },
  });

  const selected = students.data?.find((s) => s.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Administración", to: "/admin" }, { label: "Alumnos" }]} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-900">Alumnos</h1>
          <p className="text-sm text-brand-700">
            Datos personales, fotografía, tutores asignados, cuenta de acceso y matrículas, todo en
            un solo lugar.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="focus-ring rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          {showCreate ? "Cancelar" : "Nuevo alumno"}
        </button>
      </div>

      {showCreate && (
        <section className="rounded-xl border border-brand-100 bg-white p-4">
          <form
            onSubmit={handleSubmit((values) => createMutation.mutate(values))}
            className="grid gap-3 sm:grid-cols-4"
            noValidate
          >
            <Field label="Número de alumno" error={errors.student_number?.message}>
              <input className={inputClass} {...register("student_number")} />
            </Field>
            <Field label="Nombres">
              <input className={inputClass} {...register("first_name")} />
            </Field>
            <Field label="Apellidos">
              <input className={inputClass} {...register("last_name")} />
            </Field>
            <Field label="Fecha de nacimiento">
              <input type="date" className={inputClass} {...register("birth_date")} />
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
        </section>
      )}

      {students.isLoading && <LoadingState label="Cargando alumnos…" />}
      {students.error && <ErrorState error={students.error} />}
      {students.data && students.data.length === 0 && (
        <EmptyState title="Todavía no hay alumnos" description="Crea el primero con «Nuevo alumno»." />
      )}

      {students.data && students.data.length > 0 && (
        <div className="space-y-6">
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {students.data.map((student) => {
              const name = student.display_name ?? "Sin nombre registrado";
              const isSelected = student.id === selectedId;
              return (
                <li key={student.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(student.id)}
                    className={`focus-ring flex w-full flex-col items-center gap-2 rounded-xl border bg-white p-3 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                      isSelected
                        ? "border-brand-400 ring-2 ring-brand-200"
                        : "border-brand-100 hover:border-brand-300"
                    }`}
                  >
                    <StudentAvatar photoFileId={student.photo_file_id} name={name} size="h-16 w-16" />
                    <div className="min-w-0 w-full">
                      <p className="truncate font-display text-sm font-medium text-brand-900">
                        {name}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        Matrícula {student.student_number}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          {selected ? (
            <StudentDetailPanel key={selected.id} student={selected} canManageUsers={canManageUsers} />
          ) : (
            <EmptyState
              title="Selecciona un alumno"
              description="Haz clic en una tarjeta para ver y editar su expediente."
            />
          )}
        </div>
      )}
    </div>
  );
}

const personalDataSchema = z.object({
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  birth_date: z.string().optional(),
});
type PersonalDataForm = z.infer<typeof personalDataSchema>;

function StudentDetailPanel({
  student,
  canManageUsers,
}: {
  student: StudentProfile;
  canManageUsers: boolean;
}) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<PersonalDataForm>({
    resolver: zodResolver(personalDataSchema),
    defaultValues: {
      first_name: student.first_name ?? "",
      last_name: student.last_name ?? "",
      birth_date: student.birth_date ?? "",
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: PersonalDataForm) =>
      (
        await apiClient.patch<StudentProfile>(`/students/${student.id}`, {
          first_name: values.first_name || null,
          last_name: values.last_name || null,
          birth_date: values.birth_date || null,
        })
      ).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["students"] }),
  });

  return (
    <div className="space-y-4">
      <Card title="Datos personales">
        <form
          onSubmit={handleSubmit((values) => updateMutation.mutate(values))}
          className="grid gap-3 sm:grid-cols-3"
          noValidate
        >
          <Field label="Nombres">
            <input className={inputClass} {...register("first_name")} />
          </Field>
          <Field label="Apellidos">
            <input className={inputClass} {...register("last_name")} />
          </Field>
          <Field label="Fecha de nacimiento">
            <input type="date" className={inputClass} {...register("birth_date")} />
          </Field>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="focus-ring w-full rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              Guardar
            </button>
          </div>
        </form>
        {updateMutation.isError && <ErrorState error={updateMutation.error} />}
      </Card>

      <StudentPhotoCard student={student} />
      {canManageUsers && <StudentAccountCard student={student} />}
      <StudentGuardiansCard student={student} />
      <StudentHistoryCard student={student} />
    </div>
  );
}

function StudentPhotoCard({ student }: { student: StudentProfile }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useMutation({
    mutationFn: async (file: globalThis.File) => {
      const formData = new FormData();
      formData.append("upload", file);
      return (await apiClient.post(`/students/${student.id}/photo`, formData)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      queryClient.invalidateQueries({ queryKey: ["students", "photo-url"] });
      if (inputRef.current) inputRef.current.value = "";
    },
  });

  function onFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) uploadMutation.mutate(file);
  }

  return (
    <Card title="Fotografía">
      <div className="flex items-center gap-4">
        <StudentAvatar
          photoFileId={student.photo_file_id}
          name={student.display_name ?? student.student_number}
          size="h-20 w-20"
        />
        <div>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={onFileSelected}
            disabled={uploadMutation.isPending}
            className="text-sm"
          />
          {uploadMutation.isPending && <p className="text-xs text-slate-500">Subiendo…</p>}
          {uploadMutation.isError && <ErrorState error={uploadMutation.error} />}
        </div>
      </div>
    </Card>
  );
}

function StudentAccountCard({ student }: { student: StudentProfile }) {
  const queryClient = useQueryClient();
  const [linkUserId, setLinkUserId] = useState("");
  const [handleInput, setHandleInput] = useState("");

  const users = useQuery<UserListItem[]>({
    queryKey: ["users"],
    queryFn: async () => (await apiClient.get("/users")).data,
  });
  const studentUsersWithoutProfile = useQuery<UserListItem[]>({
    queryKey: ["users", { role: "student" }],
    queryFn: async () => (await apiClient.get("/users", { params: { role: "student" } })).data,
  });

  const linkedUser = student.user_id ? users.data?.find((u) => u.id === student.user_id) : null;

  const linkMutation = useMutation({
    mutationFn: async (user_id: string) =>
      (await apiClient.patch<StudentProfile>(`/students/${student.id}`, { user_id })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["students"] });
      setLinkUserId("");
    },
  });

  const handleMutation = useMutation({
    mutationFn: async (handle: string) =>
      (
        await apiClient.patch(`/users/${student.user_id}`, { handle: handle.trim() || null })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["students"] });
    },
  });

  return (
    <Card title="Cuenta de acceso">
      {linkedUser ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-700">
            {linkedUser.display_name}
            {linkedUser.username && ` · usuario: ${linkedUser.username}`}
            {linkedUser.email && ` · ${linkedUser.email}`}
          </p>
          <div className="flex items-end gap-2">
            <Field label="@username (para que lo puedan mencionar)">
              <div className="flex items-center gap-1">
                <span className="text-slate-400">@</span>
                <input
                  className={inputClass}
                  placeholder={linkedUser.handle ?? "byronpena"}
                  value={handleInput}
                  onChange={(e) => setHandleInput(e.target.value)}
                />
              </div>
            </Field>
            <button
              type="button"
              disabled={handleMutation.isPending}
              onClick={() => handleMutation.mutate(handleInput)}
              className={actionBtn + " disabled:opacity-60"}
            >
              Guardar
            </button>
          </div>
          {linkedUser.handle && !handleInput && (
            <p className="text-xs text-slate-500">Usuario actual: @{linkedUser.handle}</p>
          )}
          {handleMutation.isError && <ErrorState error={handleMutation.error} />}
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-slate-500">
            Este alumno todavía no tiene cuenta de acceso. Créala primero desde Administración &gt;
            Usuarios (rol Alumno) y vincúlala aquí.
          </p>
          <div className="flex items-end gap-2">
            <Field label="Vincular cuenta existente">
              <select
                className={inputClass}
                value={linkUserId}
                onChange={(e) => setLinkUserId(e.target.value)}
              >
                <option value="">Selecciona…</option>
                {studentUsersWithoutProfile.data?.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.display_name}
                    {user.username && ` (${user.username})`}
                  </option>
                ))}
              </select>
            </Field>
            <button
              type="button"
              disabled={!linkUserId || linkMutation.isPending}
              onClick={() => linkMutation.mutate(linkUserId)}
              className={actionBtn + " disabled:opacity-60"}
            >
              Vincular
            </button>
          </div>
          {linkMutation.isError && <ErrorState error={linkMutation.error} />}
        </div>
      )}
    </Card>
  );
}

const guardianLinkSchema = z.object({
  guardian_user_id: z.string().min(1, "Requerido."),
  relationship_label: z.string().min(1, "Requerido."),
  valid_from: z.string().min(1, "Requerido."),
});
type GuardianLinkForm = z.infer<typeof guardianLinkSchema>;

function StudentGuardiansCard({ student }: { student: StudentProfile }) {
  const queryClient = useQueryClient();
  const guardians = useQuery<GuardianLink[]>({
    queryKey: ["students", student.id, "guardians"],
    queryFn: async () => (await apiClient.get(`/students/${student.id}/guardians`)).data,
  });
  const guardianUsers = useQuery<UserListItem[]>({
    queryKey: ["users", { role: "guardian" }],
    queryFn: async () => (await apiClient.get("/users", { params: { role: "guardian" } })).data,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<GuardianLinkForm>({
    resolver: zodResolver(guardianLinkSchema),
    defaultValues: { relationship_label: "madre/padre" },
  });

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["students", student.id, "guardians"] });

  const createMutation = useMutation({
    mutationFn: async (values: GuardianLinkForm) =>
      (await apiClient.post(`/students/${student.id}/guardians`, values)).data,
    onSuccess: () => {
      invalidate();
      reset({ relationship_label: "madre/padre" });
    },
  });
  const revokeMutation = useMutation({
    mutationFn: async (linkId: string) =>
      (await apiClient.delete(`/students/${student.id}/guardians/${linkId}`)).data,
    onSuccess: invalidate,
  });

  const active = guardians.data?.filter((g) => g.status === "active") ?? [];

  return (
    <Card title="Tutores asignados">
      {guardians.isLoading && <LoadingState label="Cargando tutores…" />}
      {guardians.error && <ErrorState error={guardians.error} />}
      {guardians.data && active.length === 0 && (
        <p className="mb-3 text-sm text-slate-500">Sin tutores asignados todavía.</p>
      )}
      {active.length > 0 && (
        <ul className="mb-3 space-y-1.5">
          {active.map((link) => (
            <li key={link.id} className="flex items-center justify-between gap-2 text-sm">
              <span>
                {link.guardian_display_name ?? "Usuario eliminado"}
                <span className="ml-1 text-xs text-slate-500">({link.relationship_label})</span>
              </span>
              <button
                type="button"
                disabled={revokeMutation.isPending}
                onClick={() => revokeMutation.mutate(link.id)}
                title="Quitar tutor"
                aria-label={`Quitar a ${link.guardian_display_name ?? "este tutor"}`}
                className="focus-ring rounded-md border border-slate-300 p-1 hover:bg-slate-100 disabled:opacity-60"
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {revokeMutation.isError && <ErrorState error={revokeMutation.error} />}

      <form
        onSubmit={handleSubmit((values) => createMutation.mutate(values))}
        className="grid gap-3 sm:grid-cols-4"
        noValidate
      >
        <Field label="Tutor" error={errors.guardian_user_id?.message}>
          <select className={inputClass} {...register("guardian_user_id")}>
            <option value="">Selecciona…</option>
            {guardianUsers.data?.map((user) => (
              <option key={user.id} value={user.id}>
                {user.display_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Relación" error={errors.relationship_label?.message}>
          <input className={inputClass} {...register("relationship_label")} />
        </Field>
        <Field label="Desde" error={errors.valid_from?.message}>
          <input type="date" className={inputClass} {...register("valid_from")} />
        </Field>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="focus-ring w-full rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            Agregar
          </button>
        </div>
      </form>
      {createMutation.isError && <ErrorState error={createMutation.error} />}
    </Card>
  );
}

function StudentHistoryCard({ student }: { student: StudentProfile }) {
  const enrollments = useQuery<EnrollmentRecord[]>({
    queryKey: ["students", student.id, "enrollments"],
    queryFn: async () => (await apiClient.get(`/students/${student.id}/enrollments`)).data,
  });
  const years = useQuery<AcademicYear[]>({
    queryKey: ["academic-years"],
    queryFn: async () => (await apiClient.get("/academic-years")).data,
  });
  const sections = useQuery<Section[]>({
    queryKey: ["sections"],
    queryFn: async () => (await apiClient.get("/sections")).data,
  });

  const yearLabel = (id: string) => years.data?.find((y) => y.id === id)?.label ?? id.slice(0, 8);
  const sectionLabel = (id: string) => sections.data?.find((s) => s.id === id)?.name ?? id.slice(0, 8);

  return (
    <Card title="Historial académico">
      {enrollments.isLoading && <LoadingState label="Cargando matrículas…" />}
      {enrollments.error && <ErrorState error={enrollments.error} />}
      {enrollments.data && enrollments.data.length === 0 && (
        <p className="text-sm text-slate-500">Sin matrículas todavía.</p>
      )}
      {enrollments.data && enrollments.data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-brand-100">
                <th className={th}>Año</th>
                <th className={th}>Sección</th>
                <th className={th}>Inicio</th>
                <th className={th}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {enrollments.data.map((enrollment) => (
                <tr key={enrollment.id} className="border-b border-slate-100">
                  <td className={td}>{yearLabel(enrollment.academic_year_id)}</td>
                  <td className={td}>{sectionLabel(enrollment.section_id)}</td>
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
    </Card>
  );
}
