import { useState } from "react";
import { Link, NavLink, Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { roleLabel } from "../lib/roles";

// Navegación por rol, con selector de contexto cuando alguien tiene varios roles o
// varios colegios (sección 10).
const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `focus-ring rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors ${
    isActive ? "bg-brand-600 text-white" : "text-brand-700 hover:bg-brand-50 hover:text-brand-900"
  }`;

const mobileNavLinkClass = ({ isActive }: { isActive: boolean }) =>
  `focus-ring rounded-md px-3 py-2 text-sm font-medium ${
    isActive ? "bg-brand-600 text-white" : "text-brand-900 hover:bg-brand-50"
  }`;

export function AppShell() {
  const { me, activeSchoolId, setActiveSchoolId, logout, isInitializing } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (isInitializing) {
    return <p className="p-6 text-sm text-slate-500">Cargando…</p>;
  }
  if (!me) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const currentMembership = me.memberships.find((m) => m.school_id === activeSchoolId);
  const roles = currentMembership?.roles ?? [];
  const roleSummary = roles.map(roleLabel).join(", ");

  const navItems = [
    { to: "/", label: "Inicio", end: true },
    { to: "/courses", label: "Cursos", end: false },
    { to: "/books", label: "Libros", end: false },
    { to: "/mis-libros", label: "Mi biblioteca", end: false },
    ...(roles.includes("guardian") ? [{ to: "/my-students", label: "Mis hijos", end: false }] : []),
    ...(roles.includes("school_admin") || roles.includes("coordinator")
      ? [{ to: "/admin", label: "Administración", end: false }]
      : []),
  ];

  return (
    <div className="min-h-screen bg-brand-50/40">
      <header className="border-b border-brand-100 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <Link className="focus-ring flex items-center gap-2.5 rounded-md" to="/">
              <img
                src="/img/logo.jpg"
                alt="Colegio Linares"
                width={40}
                height={40}
                className="h-10 w-10 shrink-0 rounded-full object-cover shadow-sm"
              />
              <span className="leading-tight">
                <span className="block font-display text-sm font-bold text-brand-900">
                  Colegio Linares
                </span>
                <span className="block text-xs text-brand-700">Aula Virtual</span>
              </span>
            </Link>

            <nav aria-label="Principal" className="hidden items-center gap-1 md:flex">
              {navItems.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className={navLinkClass}>
                  {item.label}
                </NavLink>
              ))}
            </nav>

            <div className="hidden items-center gap-3 md:flex">
              {me.memberships.length > 1 && (
                <label className="flex items-center gap-1 text-sm text-slate-600">
                  Colegio:
                  <select
                    className="focus-ring rounded border border-slate-300 px-1 py-0.5"
                    value={activeSchoolId ?? ""}
                    onChange={(e) => setActiveSchoolId(e.target.value)}
                  >
                    {me.memberships.map((m) => (
                      <option key={m.school_id} value={m.school_id}>
                        {m.school_name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <Link
                className="focus-ring rounded-md px-2 py-1 text-right text-sm leading-tight hover:bg-brand-50"
                to="/perfil"
              >
                <span className="block font-medium text-brand-900">
                  {me.handle ? `@${me.handle}` : me.display_name}
                </span>
                {roleSummary && <span className="block text-xs text-brand-600">{roleSummary}</span>}
              </Link>
              <button
                type="button"
                className="focus-ring rounded-md border border-brand-200 px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
                onClick={logout}
              >
                Salir
              </button>
            </div>

            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="focus-ring inline-flex items-center justify-center rounded-md border border-brand-200 p-2 text-brand-900 md:hidden"
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav"
              aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="h-5 w-5"
                aria-hidden="true"
              >
                {mobileOpen ? (
                  <path d="M6 6l8 8M14 6l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                ) : (
                  <path
                    d="M3 5.5h14M3 10h14M3 14.5h14"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                )}
              </svg>
            </button>
          </div>

          {mobileOpen && (
            <div id="mobile-nav" className="mt-3 flex flex-col gap-1 border-t border-brand-100 pt-3 md:hidden">
              {navItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={() => setMobileOpen(false)}
                  className={mobileNavLinkClass}
                >
                  {item.label}
                </NavLink>
              ))}

              <div className="mt-2 flex flex-col gap-2 border-t border-brand-100 pt-3">
                {me.memberships.length > 1 && (
                  <label className="flex items-center gap-2 px-3 text-sm text-slate-600">
                    Colegio:
                    <select
                      className="focus-ring flex-1 rounded border border-slate-300 px-1 py-1"
                      value={activeSchoolId ?? ""}
                      onChange={(e) => setActiveSchoolId(e.target.value)}
                    >
                      {me.memberships.map((m) => (
                        <option key={m.school_id} value={m.school_id}>
                          {m.school_name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                <Link
                  className="focus-ring rounded-md px-3 py-2 text-sm hover:bg-brand-50"
                  to="/perfil"
                  onClick={() => setMobileOpen(false)}
                >
                  <span className="block font-medium text-brand-900">
                    {me.handle ? `@${me.handle}` : me.display_name}
                  </span>
                  {roleSummary && <span className="block text-xs text-brand-600">{roleSummary}</span>}
                </Link>
                <button
                  type="button"
                  className="focus-ring mx-3 rounded-md border border-brand-200 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50"
                  onClick={logout}
                >
                  Salir
                </button>
              </div>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        {activeSchoolId ? (
          <Outlet />
        ) : (
          <p className="text-slate-500">Selecciona un colegio para continuar.</p>
        )}
      </main>
    </div>
  );
}
