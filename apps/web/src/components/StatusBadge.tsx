// Estado siempre con texto, nunca solo color (sección 7 de
// aula_virtual_linares_agente_v2/01-DISENO-Y-BRANDING.md).
const STATUS_LABELS: Record<string, string> = {
  active: "Activo",
  archived: "Archivado",
  draft: "Borrador",
  published: "Publicado",
  submitted: "Entregado",
};

const STATUS_CLASSES: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  archived: "bg-slate-100 text-slate-600 ring-slate-200",
  draft: "bg-amber-50 text-amber-700 ring-amber-200",
  published: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  submitted: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

export function StatusBadge({ status }: { status: string }) {
  const className = STATUS_CLASSES[status] ?? "bg-brand-50 text-brand-700 ring-brand-200";
  const label = STATUS_LABELS[status] ?? status;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${className}`}
    >
      {label}
    </span>
  );
}
