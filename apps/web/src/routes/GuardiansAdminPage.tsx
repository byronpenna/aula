import { useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/apiClient";
import type { GradeLevel, GuardianProfile, Permissions, UserListItem } from "../lib/types";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { EmptyState, ErrorState, ForbiddenState, LoadingState } from "../components/States";
import { StudentAvatar } from "../components/StudentAvatar";

const inputClass = "focus-ring w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm";
const actionBtn = "focus-ring rounded-md border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-100";
const UNASSIGNED_GROUP = "__sin_alumnos__";

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

// Gestión de tutores (Administración > Tutores): mismo patrón que
// StudentsAdminPage.tsx — perfil de contacto propio (`GuardianProfile`),
// independiente de si ya tiene cuenta de acceso. Agrupados por el grado de
// sus alumnos para encontrar rápido "a quién llamo para el evento de 3°".
export function GuardiansAdminPage() {
  const { data: permissions, isLoading, error } = useQuery<Permissions>({
    queryKey: ["me", "permissions"],
    queryFn: async () => (await apiClient.get("/me/permissions")).data,
  });

  if (isLoading) return <LoadingState label="Cargando…" />;
  if (error) return <ErrorState error={error} />;
  if (!permissions?.permissions.includes("guardian_link:manage")) {
    return <ForbiddenState message="Solo administración o coordinación puede gestionar tutores." />;
  }
  return <GuardiansAdminContent canManageUsers={permissions.permissions.includes("users:manage")} />;
}

const createGuardianSchema = z.object({
  full_name: z.string().min(1, "El nombre completo es obligatorio."),
  phone: z.string().optional(),
  email: z.string().optional(),
});
type CreateGuardianForm = z.infer<typeof createGuardianSchema>;

function GuardiansAdminContent({ canManageUsers }: { canManageUsers: boolean }) {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("selected"));
  const [showCreate, setShowCreate] = useState(false);

  const guardians = useQuery<GuardianProfile[]>({
    queryKey: ["guardians"],
    queryFn: async () => (await apiClient.get("/guardians")).data,
  });
  // Solo para ordenar los grupos por sort_order real, no alfabéticamente —
  // mismo motivo por el que AcademicsAdminPage pide /grade-levels aparte.
  const gradeLevels = useQuery<GradeLevel[]>({
    queryKey: ["grade-levels"],
    queryFn: async () => (await apiClient.get("/grade-levels")).data,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CreateGuardianForm>({ resolver: zodResolver(createGuardianSchema) });

  const createMutation = useMutation({
    mutationFn: async (values: CreateGuardianForm) =>
      (
        await apiClient.post<GuardianProfile>("/guardians", {
          full_name: values.full_name,
          phone: values.phone || null,
          email: values.email || null,
        })
      ).data,
    onSuccess: (profile) => {
      queryClient.invalidateQueries({ queryKey: ["guardians"] });
      reset();
      setShowCreate(false);
      setSelectedId(profile.id);
    },
  });

  function selectGuardian(id: string) {
    setSelectedId(id);
    setSearchParams({ selected: id });
  }

  const selected = guardians.data?.find((g) => g.id === selectedId) ?? null;

  // Agrupación por grado (mismo espíritu que itemsByDate en
  // CourseCalendarSection): un tutor con hijos en grados distintos aparece en
  // más de un grupo; sin alumnos activos va al grupo final.
  const sortOrderByName = new Map(gradeLevels.data?.map((g) => [g.name, g.sort_order]) ?? []);
  const groups = new Map<string, GuardianProfile[]>();
  for (const guardian of guardians.data ?? []) {
    const gradeNames = new Set(
      guardian.students.map((s) => s.grade_level_name).filter((n): n is string => Boolean(n)),
    );
    if (gradeNames.size === 0) {
      groups.set(UNASSIGNED_GROUP, [...(groups.get(UNASSIGNED_GROUP) ?? []), guardian]);
      continue;
    }
    for (const name of gradeNames) {
      groups.set(name, [...(groups.get(name) ?? []), guardian]);
    }
  }
  const groupOrder = [...groups.keys()]
    .filter((name) => name !== UNASSIGNED_GROUP)
    .sort((a, b) => (sortOrderByName.get(a) ?? 0) - (sortOrderByName.get(b) ?? 0));
  if (groups.has(UNASSIGNED_GROUP)) groupOrder.push(UNASSIGNED_GROUP);

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Administración", to: "/admin" }, { label: "Tutores" }]} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-900">Tutores</h1>
          <p className="text-sm text-brand-700">
            Datos de contacto, fotografía y cuenta de acceso de cada tutor, agrupados por el grado
            de sus alumnos.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="focus-ring rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          {showCreate ? "Cancelar" : "Nuevo tutor"}
        </button>
      </div>

      {showCreate && (
        <section className="rounded-xl border border-brand-100 bg-white p-4">
          <form
            onSubmit={handleSubmit((values) => createMutation.mutate(values))}
            className="grid gap-3 sm:grid-cols-4"
            noValidate
          >
            <Field label="Nombre completo" error={errors.full_name?.message}>
              <input className={inputClass} autoFocus {...register("full_name")} />
            </Field>
            <Field label="Teléfono (opcional)">
              <input className={inputClass} {...register("phone")} />
            </Field>
            <Field label="Email (opcional)">
              <input className={inputClass} {...register("email")} />
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

      {guardians.isLoading && <LoadingState label="Cargando tutores…" />}
      {guardians.error && <ErrorState error={guardians.error} />}
      {guardians.data && guardians.data.length === 0 && (
        <EmptyState title="Todavía no hay tutores" description="Crea el primero con «Nuevo tutor»." />
      )}

      {guardians.data && guardians.data.length > 0 && (
        <div className="space-y-6">
          {groupOrder.map((groupName) => (
            <div key={groupName}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-brand-600">
                {groupName === UNASSIGNED_GROUP ? "Sin alumnos asignados" : groupName}
              </h2>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
                {groups.get(groupName)?.map((guardian) => {
                  const isSelected = guardian.id === selectedId;
                  return (
                    <li key={guardian.id}>
                      <button
                        type="button"
                        onClick={() => selectGuardian(guardian.id)}
                        className={`focus-ring flex w-full flex-col items-center gap-2 rounded-xl border bg-white p-3 text-center shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                          isSelected
                            ? "border-brand-400 ring-2 ring-brand-200"
                            : "border-brand-100 hover:border-brand-300"
                        }`}
                      >
                        <StudentAvatar
                          photoFileId={guardian.photo_file_id}
                          name={guardian.full_name}
                          size="h-16 w-16"
                        />
                        <div className="min-w-0 w-full">
                          <p className="truncate font-display text-sm font-medium text-brand-900">
                            {guardian.full_name}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {guardian.students.length === 0
                              ? "Sin alumnos"
                              : guardian.students
                                  .map((s) => s.display_name ?? s.student_number)
                                  .join(", ")}
                          </p>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {selected ? (
            <GuardianDetailPanel key={selected.id} guardian={selected} canManageUsers={canManageUsers} />
          ) : (
            <EmptyState
              title="Selecciona un tutor"
              description="Haz clic en una tarjeta para ver y editar su ficha."
            />
          )}
        </div>
      )}
    </div>
  );
}

const personalDataSchema = z.object({
  full_name: z.string().min(1, "El nombre completo es obligatorio."),
  email: z.string().optional(),
  phone: z.string().optional(),
  profession: z.string().optional(),
  workplace: z.string().optional(),
  national_id: z.string().optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
});
type PersonalDataForm = z.infer<typeof personalDataSchema>;

function GuardianDetailPanel({
  guardian,
  canManageUsers,
}: {
  guardian: GuardianProfile;
  canManageUsers: boolean;
}) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PersonalDataForm>({
    resolver: zodResolver(personalDataSchema),
    defaultValues: {
      full_name: guardian.full_name,
      email: guardian.email ?? "",
      phone: guardian.phone ?? "",
      profession: guardian.profession ?? "",
      workplace: guardian.workplace ?? "",
      national_id: guardian.national_id ?? "",
      address: guardian.address ?? "",
      notes: guardian.notes ?? "",
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (values: PersonalDataForm) =>
      (
        await apiClient.patch<GuardianProfile>(`/guardians/${guardian.id}`, {
          full_name: values.full_name,
          email: values.email || null,
          phone: values.phone || null,
          profession: values.profession || null,
          workplace: values.workplace || null,
          national_id: values.national_id || null,
          address: values.address || null,
          notes: values.notes || null,
        })
      ).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["guardians"] }),
  });

  return (
    <div className="space-y-4">
      <Card title="Datos personales">
        <form
          onSubmit={handleSubmit((values) => updateMutation.mutate(values))}
          className="grid gap-3 sm:grid-cols-3"
          noValidate
        >
          <Field label="Nombre completo" error={errors.full_name?.message}>
            <input className={inputClass} {...register("full_name")} />
          </Field>
          <Field label="Email">
            <input className={inputClass} {...register("email")} />
          </Field>
          <Field label="Teléfono">
            <input className={inputClass} {...register("phone")} />
          </Field>
          <Field label="Profesión">
            <input className={inputClass} {...register("profession")} />
          </Field>
          <Field label="Lugar de trabajo">
            <input className={inputClass} {...register("workplace")} />
          </Field>
          <Field label="Documento de identidad">
            <input className={inputClass} {...register("national_id")} />
          </Field>
          <div className="sm:col-span-3">
            <Field label="Dirección">
              <input className={inputClass} {...register("address")} />
            </Field>
          </div>
          <div className="sm:col-span-3">
            <Field label="Notas">
              <textarea className={inputClass} rows={3} {...register("notes")} />
            </Field>
          </div>
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

      <GuardianPhotoCard guardian={guardian} />
      {canManageUsers && <GuardianAccountCard guardian={guardian} />}
      <GuardianStudentsCard guardian={guardian} />
    </div>
  );
}

function GuardianPhotoCard({ guardian }: { guardian: GuardianProfile }) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useMutation({
    mutationFn: async (file: globalThis.File) => {
      const formData = new FormData();
      formData.append("upload", file);
      return (await apiClient.post(`/guardians/${guardian.id}/photo`, formData)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guardians"] });
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
        <StudentAvatar photoFileId={guardian.photo_file_id} name={guardian.full_name} size="h-20 w-20" />
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

function GuardianAccountCard({ guardian }: { guardian: GuardianProfile }) {
  const queryClient = useQueryClient();
  const [linkUserId, setLinkUserId] = useState("");
  const [handleInput, setHandleInput] = useState("");

  const users = useQuery<UserListItem[]>({
    queryKey: ["users"],
    queryFn: async () => (await apiClient.get("/users")).data,
  });
  const guardianUsersWithoutProfile = useQuery<UserListItem[]>({
    queryKey: ["users", { role: "guardian" }],
    queryFn: async () => (await apiClient.get("/users", { params: { role: "guardian" } })).data,
  });

  const linkedUser = guardian.user_id ? users.data?.find((u) => u.id === guardian.user_id) : null;

  const linkMutation = useMutation({
    mutationFn: async (user_id: string) =>
      (await apiClient.patch<GuardianProfile>(`/guardians/${guardian.id}`, { user_id })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["guardians"] });
      setLinkUserId("");
    },
  });

  const handleMutation = useMutation({
    mutationFn: async (handle: string) =>
      (await apiClient.patch(`/users/${guardian.user_id}`, { handle: handle.trim() || null })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["guardians"] });
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
            Este tutor todavía no tiene cuenta de acceso (la mayoría no la necesita). Créala desde
            Administración &gt; Usuarios (rol Tutor) y vincúlala aquí si hace falta.
          </p>
          <div className="flex items-end gap-2">
            <Field label="Vincular cuenta existente">
              <select
                className={inputClass}
                value={linkUserId}
                onChange={(e) => setLinkUserId(e.target.value)}
              >
                <option value="">Selecciona…</option>
                {guardianUsersWithoutProfile.data?.map((user) => (
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

// Solo lectura: agregar/quitar alumnos vinculados se hace desde la ficha del
// alumno (StudentsAdminPage.tsx::StudentGuardiansCard), no aquí — evita tener
// el mismo formulario duplicado en dos pantallas.
function GuardianStudentsCard({ guardian }: { guardian: GuardianProfile }) {
  return (
    <Card title="Alumnos vinculados">
      {guardian.students.length === 0 ? (
        <p className="text-sm text-slate-500">
          Sin alumnos vinculados todavía. Agrégalo desde la ficha del alumno, en «Tutores
          asignados».
        </p>
      ) : (
        <ul className="space-y-1.5">
          {guardian.students.map((student) => (
            <li key={student.id} className="flex items-center justify-between gap-2 text-sm">
              <Link to={`/students/${student.id}`} className="focus-ring text-brand-700 hover:underline">
                {student.display_name ?? student.student_number}
              </Link>
              <span className="text-xs text-slate-500">
                {student.grade_level_name ?? "Sin grado asignado"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
