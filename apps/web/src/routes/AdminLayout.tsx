import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";

// Shell de administración (01-DISENO-Y-BRANDING.md §4 "Sidebar"): vive DENTRO del
// <Outlet/> de AppShell, no repite header/autenticación. Solo lista los módulos que
// existen hoy — nada de Usuarios/Roles/Reportes todavía (esos módulos no existen ni
// en frontend ni en backend; un enlace a ellos sería un botón decorativo, prohibido
// por 06-PRUEBAS-Y-CRITERIOS.md §6).
const NAV_ITEMS = [
  { to: "/admin", label: "Inicio", end: true },
  { to: "/admin/academics", label: "Academia", end: false },
];

export function AdminLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);

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
        <nav aria-label="Administración" className="flex flex-col gap-1">
          {NAV_ITEMS.map((item) => (
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
        </nav>
      </aside>

      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}
