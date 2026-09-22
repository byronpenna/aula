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
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-4">
            <span className="font-semibold text-slate-900">Aula Virtual</span>
            <nav className="flex gap-3 text-sm text-slate-600">
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
                <Link className="focus-ring rounded px-1" to="/admin/academics">
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
            <button className="focus-ring rounded text-sky-700 underline" onClick={logout}>
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
