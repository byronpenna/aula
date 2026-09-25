import { Link } from "react-router-dom";
import type { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: number | undefined;
  isLoading: boolean;
  isError: boolean;
  href?: string;
}

// Nunca inventa un número: mientras carga muestra un esqueleto, si falla dice "No
// disponible" en vez de mostrar 0 o el mockup ("156 cursos" es ilustrativo, no un
// dato real — ver 01-DISENO-Y-BRANDING.md §8).
export function MetricCard({ label, value, isLoading, isError, href }: MetricCardProps) {
  const content: ReactNode = isLoading ? (
    <span className="block h-8 w-12 animate-pulse rounded bg-brand-100" aria-hidden="true" />
  ) : isError ? (
    <span className="text-base font-medium text-slate-400">No disponible</span>
  ) : (
    <span className="text-3xl font-bold text-brand-900">{value}</span>
  );

  const card = (
    <div className="rounded-xl border border-brand-100 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-brand-700">{label}</p>
      <div className="mt-1">{content}</div>
    </div>
  );

  if (href && !isLoading && !isError) {
    return (
      <Link to={href} className="focus-ring block rounded-xl transition-shadow hover:shadow-md">
        {card}
      </Link>
    );
  }
  return card;
}
