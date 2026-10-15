import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient, ApiError } from "../lib/apiClient";
import type { Permission, Permissions, RoleSummary, RoleUser } from "../lib/types";
import { ErrorState, ForbiddenState, LoadingState } from "../components/States";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { StatusBadge } from "../components/StatusBadge";

export function AdminRolesPage() {
  const { data: permissions, isLoading, error } = useQuery<Permissions>({
    queryKey: ["me", "permissions"],
    queryFn: async () => (await apiClient.get("/me/permissions")).data,
  });

  if (isLoading) return <LoadingState label="Cargando…" />;
  if (error) return <ErrorState error={error} />;
  if (!permissions?.permissions.includes("roles:manage")) {
    return <ForbiddenState message="Solo administración escolar puede gestionar roles." />;
  }
  return <AdminRolesContent />;
}

function AdminRolesContent() {
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const roles = useQuery<RoleSummary[]>({
    queryKey: ["roles"],
    queryFn: async () => (await apiClient.get("/roles")).data,
  });
  const allPermissions = useQuery<Permission[]>({
    queryKey: ["permissions"],
    queryFn: async () => (await apiClient.get("/permissions")).data,
  });

  const selected = roles.data?.find((r) => r.code === selectedCode) ?? roles.data?.[0] ?? null;

  return (
    <div className="space-y-4">
      <Breadcrumbs items={[{ label: "Administración", to: "/admin" }, { label: "Roles y permisos" }]} />
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-900">Roles y permisos</h1>
        <p className="text-sm text-brand-700">
          Edita qué puede hacer cada rol. Los roles del sistema no cambian de nombre, solo permisos.
        </p>
      </div>

      {roles.isLoading && <LoadingState label="Cargando roles…" />}
      {roles.error && <ErrorState error={roles.error} />}

      {roles.data && (
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          <aside className="w-full shrink-0 rounded-xl border border-brand-100 bg-white p-3 md:w-64">
            <nav className="flex flex-col gap-1">
              {roles.data.map((role) => (
                <button
                  key={role.code}
                  type="button"
                  onClick={() => setSelectedCode(role.code)}
                  className={`focus-ring flex items-center justify-between rounded-md px-3 py-2 text-left text-sm ${
                    selected?.code === role.code
                      ? "bg-brand-600 text-white"
                      : "text-brand-900 hover:bg-brand-50"
                  }`}
                >
                  <span>{role.name}</span>
                  <span
                    className={selected?.code === role.code ? "text-white/80" : "text-slate-400"}
                  >
                    {role.assigned_user_count}
                  </span>
                </button>
              ))}
            </nav>
          </aside>

          <div className="min-w-0 flex-1">
            {selected && (
              <RoleDetail
                key={selected.code}
                role={selected}
                allPermissions={allPermissions.data ?? []}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function permissionModule(code: string): string {
  return code.split(":")[0];
}

// Se monta con `key={role.code}` desde el padre: cambiar de rol crea una instancia
// nueva con su propio estado inicial, en vez de sincronizar props→estado con un
// efecto (evita el render en cascada de "setState síncrono dentro de un efecto").
function RoleDetail({ role, allPermissions }: { role: RoleSummary; allPermissions: Permission[] }) {
  const queryClient = useQueryClient();
  const [selectedCodes, setSelectedCodes] = useState<Set<string>>(new Set(role.permission_codes));
  const [conflict, setConflict] = useState(false);

  const usersQuery = useQuery<RoleUser[]>({
    queryKey: ["roles", role.code, "users"],
    queryFn: async () => (await apiClient.get(`/roles/${role.code}/users`)).data,
  });

  const saveMutation = useMutation({
    mutationFn: async () =>
      (
        await apiClient.put(`/roles/${role.code}/permissions`, {
          expected_version: role.version,
          permission_codes: Array.from(selectedCodes),
        })
      ).data,
    onSuccess: () => {
      setConflict(false);
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 409) {
        setConflict(true);
      }
    },
  });

  function toggle(code: string) {
    setSelectedCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  const grouped = allPermissions.reduce<Record<string, Permission[]>>((acc, p) => {
    const mod = permissionModule(p.code);
    (acc[mod] ??= []).push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-brand-100 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-brand-900">{role.name}</h2>
            <p className="text-xs text-slate-500">
              {role.is_system ? "Rol del sistema (código fijo)" : "Rol personalizado"} · versión{" "}
              {role.version}
            </p>
          </div>
          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="focus-ring rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            Guardar permisos
          </button>
        </div>

        {conflict && (
          <p role="alert" className="mb-3 text-sm text-amber-700">
            El rol fue actualizado por otro administrador mientras editabas. Recarga la página para
            ver los cambios antes de guardar de nuevo.
          </p>
        )}
        {saveMutation.isError && !conflict && <ErrorState error={saveMutation.error} />}

        <div className="grid gap-4 sm:grid-cols-2">
          {Object.entries(grouped).map(([mod, perms]) => (
            <div key={mod}>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-700">
                {mod}
              </p>
              <ul className="space-y-1">
                {perms.map((p) => (
                  <li key={p.code}>
                    <label className="flex items-start gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        className="mt-0.5"
                        checked={selectedCodes.has(p.code)}
                        onChange={() => toggle(p.code)}
                      />
                      <span>{p.description}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-brand-100 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-brand-900">Usuarios con este rol</h2>
        {usersQuery.isLoading && <LoadingState label="Cargando…" />}
        {usersQuery.error && <ErrorState error={usersQuery.error} />}
        {usersQuery.data && usersQuery.data.length === 0 && (
          <p className="text-sm text-slate-500">Nadie tiene este rol todavía.</p>
        )}
        {usersQuery.data && usersQuery.data.length > 0 && (
          <ul className="space-y-1">
            {usersQuery.data.map((u) => (
              <li key={u.id} className="flex items-center justify-between text-sm text-slate-700">
                <span>
                  {u.display_name} {u.email && <span className="text-slate-400">· {u.email}</span>}
                </span>
                <StatusBadge status={u.membership_status === "active" ? "active" : "archived"} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
