import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Navegación por rol, con selector de contexto cuando alguien tiene varios roles o
// varios colegios (sección 10).
export function AppShell() {
  const { me, activeSchoolId, setActiveSchoolId, logout, isInitializing } = useAuth();
  const location = useLocation();

  if (isInitializing) {
    return <p className="p-6 text-sm text-slate-500">Cargando…</p>;
  }
  if (!me) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  const currentMembership = me.memberships.find((m) => m.school_id === activeSchoolId);
  const roles = currentMembership?.roles ?? [];

  return (
    <div className="min-h-screen bg-brand-50/40">
      <header className="border-b border-brand-100 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-4">
            <Link className="focus-ring flex items-center gap-2.5 rounded-md" to="/">
              <img
                src="/img/logo.jpg"
                alt="Colegio Linares"
                width={40}
                height={40}
                className="h-10 w-10 rounded-full object-cover shadow-sm"
              />
              <span className="leading-tight">
                <span className="block font-display text-sm font-bold text-brand-900">
                  Colegio Linares
                </span>
                <span className="block text-xs text-brand-700">Aula Virtual</span>
              </span>
            </Link>
            <nav className="flex gap-3 text-sm text-brand-700">
              <Link className="focus-ring rounded px-1" to="/">
                Inicio
              </Link>
              <Link className="focus-ring rounded px-1" to="/courses">
                Cursos
              </Link>
              {roles.includes("guardian") && (
                <Link className="focus-ring rounded px-1" to="/my-students">
                  Mis hijos
                </Link>
              )}
              {(roles.includes("school_admin") || roles.includes("coordinator")) && (
                <Link className="focus-ring rounded px-1" to="/admin">
                  Administración
                </Link>
              )}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-slate-600">
            {me.memberships.length > 1 && (
              <label className="flex items-center gap-1">
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
            <span>
              {me.display_name}
              {roles.length > 0 && ` · ${roles.join(", ")}`}
            </span>
            <button className="focus-ring rounded text-brand-700 underline" onClick={logout}>
              Salir
            </button>
          </div>
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
