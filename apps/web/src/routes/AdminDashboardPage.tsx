import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiClient } from "../lib/apiClient";
import type { AcademicYear, Course, GradeLevel, Permissions, Section, Subject } from "../lib/types";
import { ErrorState, ForbiddenState, LoadingState } from "../components/States";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { MetricCard } from "../components/MetricCard";

// Mismas query keys que AcademicsAdminPage.tsx: la caché de React Query se comparte
// al navegar entre el dashboard y el módulo de Academia, sin pedir el dato dos veces.
function useCount<T>(key: string, url: string) {
  return useQuery<T[]>({ queryKey: [key], queryFn: async () => (await apiClient.get(url)).data });
}

const QUICK_LINKS: { label: string; tab: string }[] = [
  { label: "Nuevo año académico", tab: "years" },
  { label: "Nuevo grado", tab: "grades" },
  { label: "Nueva materia", tab: "subjects" },
  { label: "Nueva sección", tab: "sections" },
  { label: "Nuevo curso", tab: "courses" },
  { label: "Gestionar inscripciones", tab: "enrollments" },
];

export function AdminDashboardPage() {
  const { data: permissions, isLoading, error } = useQuery<Permissions>({
    queryKey: ["me", "permissions"],
    queryFn: async () => (await apiClient.get("/me/permissions")).data,
  });

  const years = useCount<AcademicYear>("academic-years", "/academic-years");
  const grades = useCount<GradeLevel>("grade-levels", "/grade-levels");
  const subjects = useCount<Subject>("subjects", "/subjects");
  const sections = useCount<Section>("sections", "/sections");
  const courses = useCount<Course>("courses", "/courses");

  if (isLoading) return <LoadingState label="Cargando…" />;
  if (error) return <ErrorState error={error} />;
  if (!permissions?.permissions.includes("academics:manage")) {
    return (
      <ForbiddenState message="Solo administración escolar o coordinación pueden ver este panel." />
    );
  }

  return (
    <div className="space-y-6">
      <Breadcrumbs items={[{ label: "Administración" }]} />
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-900">Administración</h1>
        <p className="text-sm text-brand-700">
          Gestiona la estructura académica y la configuración del sistema.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <MetricCard
          label="Años académicos"
          value={years.data?.length}
          isLoading={years.isLoading}
          isError={years.isError}
          href="/admin/academics?tab=years"
        />
        <MetricCard
          label="Grados"
          value={grades.data?.length}
          isLoading={grades.isLoading}
          isError={grades.isError}
          href="/admin/academics?tab=grades"
        />
        <MetricCard
          label="Materias"
          value={subjects.data?.length}
          isLoading={subjects.isLoading}
          isError={subjects.isError}
          href="/admin/academics?tab=subjects"
        />
        <MetricCard
          label="Secciones"
          value={sections.data?.length}
          isLoading={sections.isLoading}
          isError={sections.isError}
          href="/admin/academics?tab=sections"
        />
        <MetricCard
          label="Cursos"
          value={courses.data?.length}
          isLoading={courses.isLoading}
          isError={courses.isError}
          href="/admin/academics?tab=courses"
        />
      </div>

      <section className="rounded-xl border border-brand-100 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-brand-900">Accesos rápidos</h2>
        <div className="flex flex-wrap gap-2">
          {QUICK_LINKS.map((link) => (
            <Link
              key={link.tab}
              to={`/admin/academics?tab=${link.tab}`}
              className="focus-ring rounded-md border border-brand-200 px-3 py-1.5 text-sm text-brand-900 hover:bg-brand-50"
            >
              {link.label}
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
