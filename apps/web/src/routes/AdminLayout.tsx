import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/apiClient";
import type { Permissions } from "../lib/types";

// Shell de administración (01-DISENO-Y-BRANDING.md §4 "Sidebar"): vive DENTRO del
// <Outlet/> de AppShell, no repite header/autenticación. Cada sección solo aparece
// si el permiso correspondiente existe de verdad en el backend — nunca un enlace a
// un módulo sin implementar (06-PRUEBAS-Y-CRITERIOS.md §6: "no dejar botones
// decorativos"). El backend vuelve a exigir el permiso en cada endpoint; esto es
// solo para no ofrecer una puerta que el propio servidor va a cerrar.
interface NavSection {
  title?: string;
  requiresPermission?: string;
  items: { to: string; label: string; end: boolean }[];
}

const NAV_SECTIONS: NavSection[] = [
  { items: [{ to: "/admin", label: "Inicio", end: true }] },
  {
    title: "Academia",
    requiresPermission: "academics:manage",
    items: [{ to: "/admin/academics", label: "Academia", end: false }],
  },
  {
    title: "Usuarios",
    requiresPermission: "users:manage",
    items: [
      { to: "/admin/users", label: "Usuarios", end: false },
      { to: "/admin/roles", label: "Roles y permisos", end: false },
    ],
  },
];

export function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: permissions } = useQuery<Permissions>({
    queryKey: ["me", "permissions"],
    queryFn: async () => (await apiClient.get("/me/permissions")).data,
  });

  const sections = NAV_SECTIONS.filter(
    (section) =>
      !section.requiresPermission || permissions?.permissions.includes(section.requiresPermission),
  );

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-start">
      <button
        type="button"
        onClick={() => setMobileOpen((v) => !v)}
        className="focus-ring inline-flex items-center gap-2 self-start rounded-md border border-brand-200 bg-white px-3 py-1.5 text-sm font-medium text-brand-900 md:hidden"
        aria-expanded={mobileOpen}
        aria-controls="admin-sidebar"
      >
        {mobileOpen ? "Cerrar menú" : "Menú de administración"}
      </button>

      <aside
        id="admin-sidebar"
        className={`${mobileOpen ? "block" : "hidden"} w-full shrink-0 rounded-xl border border-brand-100 bg-white p-3 md:block md:w-56`}
      >
        <nav aria-label="Administración" className="flex flex-col gap-3">
          {sections.map((section, index) => (
            <div key={section.title ?? `section-${index}`} className="flex flex-col gap-1">
              {section.title && (
                <p className="px-3 text-xs font-semibold uppercase tracking-wide text-brand-400">
                  {section.title}
                </p>
              )}
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMobileOpen(false)}
                  className={({ isActive }) =>
                    `focus-ring rounded-md px-3 py-2 text-sm font-medium ${
                      isActive ? "bg-brand-600 text-white" : "text-brand-900 hover:bg-brand-50"
                    }`
                  }
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
