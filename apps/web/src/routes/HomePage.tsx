import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/apiClient";
import type { AcademicYear, Course, Permissions, StudentProfile, Teacher } from "../lib/types";
import { ErrorState, LoadingState } from "../components/States";
import { useAuth } from "../context/AuthContext";
import { MetricCard } from "../components/MetricCard";

// Las mismas query keys que AdminDashboardPage.tsx / AcademicsAdminPage.tsx y
// AdminUsersPage.tsx: la caché de React Query se comparte al navegar entre esta
// pantalla y esas, sin pedir el dato dos veces.
export function HomePage() {
  const { me } = useAuth();
  const {
    data: permissions,
    isLoading: isLoadingPermissions,
    error: permissionsError,
  } = useQuery<Permissions>({
    queryKey: ["me", "permissions"],
    queryFn: async () => (await apiClient.get("/me/permissions")).data,
  });

  // "Año académico activo" y "cursos activos" usan course:read, que tienen los 6
  // roles (sección 6 del catálogo de permisos); matrícula y docentes son
  // conteos de todo el colegio y solo tienen sentido (y permiso) para quien
  // administra la academia (school_admin/coordinator).
  const canSeeEnrollment = permissions?.permissions.includes("enrollment:manage") ?? false;
  const canSeeTeacherCount = permissions?.permissions.includes("academics:manage") ?? false;

  const years = useQuery<AcademicYear[]>({
    queryKey: ["academic-years"],
    queryFn: async () => (await apiClient.get("/academic-years")).data,
    enabled: !isLoadingPermissions && !permissionsError,
  });
  // `/courses` ya viene filtrado por rol en el backend (sección 6: admin/coordinación
  // ven todo el colegio, docente sus cursos asignados, alumno/tutor los suyos), así
  // que "cursos activos" refleja el alcance de cada quien, no un total forzado.
  const courses = useQuery<Course[]>({
    queryKey: ["courses"],
    queryFn: async () => (await apiClient.get("/courses")).data,
    enabled: !isLoadingPermissions && !permissionsError,
  });
  const students = useQuery<StudentProfile[]>({
    queryKey: ["students"],
    queryFn: async () => (await apiClient.get("/students")).data,
    enabled: canSeeEnrollment,
  });
  const teachers = useQuery<Teacher[]>({
    queryKey: ["teachers"],
    queryFn: async () => (await apiClient.get("/teachers")).data,
    enabled: canSeeTeacherCount,
  });

  if (isLoadingPermissions) return <LoadingState />;
  if (permissionsError) return <ErrorState error={permissionsError} />;

  const activeYear = years.data?.find((year) => year.status === "active");
  const activeCoursesCount = courses.data?.filter((course) => course.status === "active").length;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold text-brand-900">Hola, {me?.display_name}</h1>

      <div className="rounded-xl border border-brand-100 bg-white p-4 shadow-sm">
        <p className="text-xs font-medium uppercase tracking-wide text-brand-700">
          Año académico activo
        </p>
        <p className="mt-1 text-2xl font-bold text-brand-900">
          {years.isLoading ? (
            <span className="block h-8 w-24 animate-pulse rounded bg-brand-100" aria-hidden="true" />
          ) : years.isError ? (
            <span className="text-base font-medium text-slate-400">No disponible</span>
          ) : (
            (activeYear?.label ?? "Sin año activo")
          )}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <MetricCard
          label="Cursos activos"
          value={activeCoursesCount}
          isLoading={courses.isLoading}
          isError={courses.isError}
          href="/courses"
        />
        {canSeeEnrollment && (
          <MetricCard
            label="Estudiantes matriculados"
            value={students.data?.length}
            isLoading={students.isLoading}
            isError={students.isError}
            href="/admin/academics?tab=enrollments"
          />
        )}
        {canSeeTeacherCount && (
          <MetricCard
            label="Docentes"
            value={teachers.data?.length}
            isLoading={teachers.isLoading}
            isError={teachers.isError}
            href="/admin/users"
          />
        )}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-medium text-slate-700">Tus permisos en este colegio</h2>
        <ul className="flex flex-wrap gap-2">
          {permissions?.permissions.map((p) => (
            <li key={p} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {p}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
