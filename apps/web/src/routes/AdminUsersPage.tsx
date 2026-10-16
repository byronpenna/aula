import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/apiClient";
import type { Permissions, RoleSummary, UserCreateResult, UserListItem } from "../lib/types";
import { ErrorState, ForbiddenState, LoadingState } from "../components/States";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { StatusBadge } from "../components/StatusBadge";

const inputClass = "focus-ring w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm";
const th = "px-2 py-1.5 text-left text-xs font-medium text-brand-700";
const td = "px-2 py-1.5 text-sm text-slate-700";
const actionBtn = "focus-ring rounded-md border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-100";

// Genera una contraseña que ya cumple la política real del User Pool de Cognito
// (infra/lib/identity-stack.ts: 12+ caracteres, mayúscula, minúscula, dígito) — se
// muestra editable en el propio formulario. Si el backend tiene el correo de
// invitaciones configurado (MAIL_FROM_ADDRESS), esta contraseña viaja solo por
// correo y la respuesta de POST /users no la repite (ver `UserCreateResult`);
// si no, el administrador la comunica por su cuenta.
function generatePassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = new Uint32Array(14);
  crypto.getRandomValues(bytes);
  let candidate = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  if (!/[A-Z]/.test(candidate)) candidate = "A" + candidate.slice(1);
  if (!/[a-z]/.test(candidate)) candidate = candidate.slice(0, 1) + "a" + candidate.slice(2);
  if (!/[0-9]/.test(candidate)) candidate = candidate.slice(0, 2) + "7" + candidate.slice(3);
  return candidate;
}

const SEGMENTS: { key: string; label: string; role?: string }[] = [
  { key: "all", label: "Todos" },
  { key: "school_admin", label: "Administradores", role: "school_admin" },
  { key: "coordinator", label: "Coordinación", role: "coordinator" },
  { key: "teacher", label: "Docentes", role: "teacher" },
  { key: "student", label: "Alumnos", role: "student" },
  { key: "guardian", label: "Padres de familia", role: "guardian" },
];

const createUserSchema = z.object({
  display_name: z.string().min(1, "Requerido."),
  email: z.string().optional(),
  username: z.string().min(1, "Requerido."),
  password: z.string().min(12, "Mínimo 12 caracteres (política del proveedor de identidad)."),
  role_code: z.string().min(1, "Requerido."),
});
type CreateUserForm = z.infer<typeof createUserSchema>;

export function AdminUsersPage() {
  const { data: permissions, isLoading, error } = useQuery<Permissions>({
    queryKey: ["me", "permissions"],
    queryFn: async () => (await apiClient.get("/me/permissions")).data,
  });

  if (isLoading) return <LoadingState label="Cargando…" />;
  if (error) return <ErrorState error={error} />;
  if (!permissions?.permissions.includes("users:manage")) {
    return <ForbiddenState message="Solo administración escolar puede gestionar usuarios." />;
  }
  return <AdminUsersContent />;
}

function AdminUsersContent() {
  const queryClient = useQueryClient();
  const [segment, setSegment] = useState("all");
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [lastResult, setLastResult] = useState<UserCreateResult | null>(null);

  const roles = useQuery<RoleSummary[]>({
    queryKey: ["roles"],
    queryFn: async () => (await apiClient.get("/roles")).data,
  });

  const activeSegment = SEGMENTS.find((s) => s.key === segment);
  const { data, isLoading, error } = useQuery<UserListItem[]>({
    queryKey: ["users", activeSegment?.role ?? null, status, q],
    queryFn: async () =>
      (
        await apiClient.get("/users", {
          params: {
            role: activeSegment?.role,
            status: status || undefined,
            q: q || undefined,
          },
        })
      ).data,
  });

  const invalidateUsers = () => queryClient.invalidateQueries({ queryKey: ["users"] });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: { password: generatePassword() },
  });
  const currentPassword = watch("password");

  const createMutation = useMutation({
    mutationFn: async (values: CreateUserForm) =>
      (
        await apiClient.post<UserCreateResult>("/users", {
          ...values,
          email: values.email || null,
        })
      ).data,
    onSuccess: (result) => {
      invalidateUsers();
      reset({ password: generatePassword() });
      setLastResult(result);
      setShowForm(false);
    },
  });

  return (
    <div className="space-y-4">
      <Breadcrumbs items={[{ label: "Administración", to: "/admin" }, { label: "Usuarios" }]} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-900">Usuarios</h1>
          <p className="text-sm text-brand-700">
            Crea cuentas, asigna roles y activa o desactiva el acceso al colegio.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowForm((v) => !v);
            setLastResult(null);
          }}
          className="focus-ring rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          {showForm ? "Cancelar" : "Nuevo usuario"}
        </button>
      </div>

      {lastResult && !showForm && (
        <section
          className={`rounded-xl border p-4 text-sm ${
            lastResult.invitation_sent
              ? "border-green-200 bg-green-50 text-green-800"
              : "border-amber-200 bg-amber-50 text-amber-800"
          }`}
        >
          {lastResult.invitation_sent ? (
            <p>
              Se creó la cuenta de <strong>{lastResult.display_name}</strong> y se envió la invitación
              con sus credenciales a <strong>{lastResult.email}</strong>.
            </p>
          ) : (
            <>
              <p>
                Se creó la cuenta de <strong>{lastResult.display_name}</strong>. No hay servicio de
                correo configurado para este ambiente: comparte tú mismo la contraseña con la persona;
                deberá cambiarla en su primer inicio de sesión.
              </p>
              <p className="mt-1 font-mono text-xs">
                Usuario: {lastResult.username} · Contraseña: {lastResult.temporary_password}
              </p>
            </>
          )}
        </section>
      )}

      {showForm && (
        <section className="rounded-xl border border-brand-100 bg-white p-4">
          <p className="mb-3 text-xs text-amber-700">
            Si este ambiente no tiene servicio de correo configurado, la contraseña no se enviará por
            email: deberás copiarla y compartirla tú mismo con la persona después de crear la cuenta.
          </p>
          <form
            onSubmit={handleSubmit((values) => createMutation.mutate(values))}
            className="grid gap-3 sm:grid-cols-3"
            noValidate
          >
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Nombre completo</label>
              <input className={inputClass} {...register("display_name")} />
              {errors.display_name && (
                <p className="mt-0.5 text-xs text-red-600">{errors.display_name.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Correo (opcional)</label>
              <input type="email" className={inputClass} {...register("email")} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Usuario (para iniciar sesión)
              </label>
              <input className={inputClass} {...register("username")} />
              {errors.username && (
                <p className="mt-0.5 text-xs text-red-600">{errors.username.message}</p>
              )}
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Rol</label>
              <select className={inputClass} {...register("role_code")}>
                <option value="">Selecciona…</option>
                {roles.data?.map((role) => (
                  <option key={role.code} value={role.code}>
                    {role.name}
                  </option>
                ))}
              </select>
              {errors.role_code && (
                <p className="mt-0.5 text-xs text-red-600">{errors.role_code.message}</p>
              )}
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Contraseña inicial (generada, editable)
              </label>
              <div className="flex gap-2">
                <input className={inputClass + " font-mono"} {...register("password")} />
                <button
                  type="button"
                  onClick={() => setValue("password", generatePassword())}
                  className={actionBtn}
                >
                  Generar otra
                </button>
              </div>
              {errors.password && (
                <p className="mt-0.5 text-xs text-red-600">{errors.password.message}</p>
              )}
              {!errors.password && (
                <p className="mt-0.5 text-xs text-slate-500">Valor actual: {currentPassword}</p>
              )}
            </div>
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

      <div className="flex flex-wrap gap-2 border-b border-brand-100 pb-2">
        {SEGMENTS.map((seg) => (
          <button
            key={seg.key}
            type="button"
            onClick={() => setSegment(seg.key)}
            className={`focus-ring rounded-full px-3 py-1 text-xs font-medium ${
              segment === seg.key ? "bg-brand-600 text-white" : "bg-brand-50 text-brand-700"
            }`}
          >
            {seg.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          className={inputClass + " max-w-xs"}
          placeholder="Buscar por nombre o correo…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className={inputClass + " max-w-[10rem]"} value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Todos los estados</option>
          <option value="active">Activos</option>
          <option value="inactive">Inactivos</option>
        </select>
      </div>

      {isLoading && <LoadingState label="Cargando usuarios…" />}
      {error && <ErrorState error={error} />}
      {data && data.length === 0 && <p className="text-sm text-slate-500">Sin usuarios para este filtro.</p>}
      {data && data.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-brand-100">
                <th className={th}>Nombre</th>
                <th className={th}>Usuario / correo</th>
                <th className={th}>Roles</th>
                <th className={th}>Estado</th>
                <th className={th}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {data.map((user) => (
                <UserRow key={user.id} user={user} roles={roles.data ?? []} onChanged={invalidateUsers} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function UserRow({
  user,
  roles,
  onChanged,
}: {
  user: UserListItem;
  roles: RoleSummary[];
  onChanged: () => void;
}) {
  const [roleToAdd, setRoleToAdd] = useState("");
  const statusMutation = useMutation({
    mutationFn: async (action: "activate" | "deactivate") =>
      (await apiClient.post(`/users/${user.id}/${action}`)).data,
    onSuccess: onChanged,
  });
  const assignMutation = useMutation({
    mutationFn: async (role_code: string) =>
      (await apiClient.post(`/users/${user.id}/role-assignments`, { role_code })).data,
    onSuccess: () => {
      onChanged();
      setRoleToAdd("");
    },
  });
  const revokeMutation = useMutation({
    mutationFn: async (role_code: string) =>
      (await apiClient.delete(`/users/${user.id}/role-assignments/${role_code}`)).data,
    onSuccess: onChanged,
  });

  const availableRoles = useMemo(
    () => roles.filter((r) => !user.role_codes.includes(r.code)),
    [roles, user.role_codes],
  );

  return (
    <tr className="border-b border-slate-100 align-top">
      <td className={td}>{user.display_name}</td>
      <td className={td}>
        <div>{user.username ?? "—"}</div>
        {user.email && <div className="text-xs text-slate-500">{user.email}</div>}
      </td>
      <td className={td}>
        <div className="flex flex-wrap gap-1">
          {user.role_codes.map((code) => (
            <span
              key={code}
              className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700"
            >
              {code}
              <button
                type="button"
                onClick={() => revokeMutation.mutate(code)}
                aria-label={`Quitar rol ${code}`}
                className="focus-ring rounded-full text-brand-400 hover:text-red-600"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        {availableRoles.length > 0 && (
          <div className="mt-1 flex gap-1">
            <select
              className="focus-ring rounded border border-slate-300 px-1.5 py-0.5 text-xs"
              value={roleToAdd}
              onChange={(e) => setRoleToAdd(e.target.value)}
            >
              <option value="">+ rol…</option>
              {availableRoles.map((r) => (
                <option key={r.code} value={r.code}>
                  {r.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              disabled={!roleToAdd || assignMutation.isPending}
              onClick={() => assignMutation.mutate(roleToAdd)}
              className={actionBtn + " disabled:opacity-60"}
            >
              Agregar
            </button>
          </div>
        )}
        {(assignMutation.isError || revokeMutation.isError) && (
          <ErrorState error={assignMutation.error ?? revokeMutation.error} />
        )}
      </td>
      <td className={td}>
        <StatusBadge status={user.membership_status === "active" ? "active" : "archived"} />
      </td>
      <td className={td}>
        <button
          type="button"
          disabled={statusMutation.isPending}
          onClick={() =>
            statusMutation.mutate(user.membership_status === "active" ? "deactivate" : "activate")
          }
          className={actionBtn}
        >
          {user.membership_status === "active" ? "Desactivar" : "Activar"}
        </button>
        {statusMutation.isError && <ErrorState error={statusMutation.error} />}
      </td>
    </tr>
  );
}
