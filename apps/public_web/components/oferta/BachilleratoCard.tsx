import Link from "next/link";
import type { Bachillerato } from "@/lib/bachilleratos";
import { ArrowRightIcon } from "@/components/icons";
import { BachilleratoVisual } from "./BachilleratoVisual";

export function BachilleratoCard({ bachillerato }: { bachillerato: Bachillerato }) {
  return (
    <Link
      href={`/oferta-academica/${bachillerato.slug}`}
      className="focus-ring group flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-brand-100 transition-shadow hover:shadow-md"
    >
      <BachilleratoVisual area={bachillerato.area} variant="card" />

      <div className="flex flex-1 flex-col p-6">
        <span className="text-xs font-bold uppercase tracking-wide text-accent-500">
          {bachillerato.etiquetaArea}
        </span>
        <h3 className="font-display mt-1.5 text-lg font-bold text-brand-900">
          {bachillerato.titulo}
        </h3>
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-brand-600">
          {bachillerato.resumen}
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {bachillerato.intereses.slice(0, 3).map((interes) => (
            <span
              key={interes}
              className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700"
            >
              {interes}
            </span>
          ))}
        </div>

        <span className="focus-ring mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-800 group-hover:text-brand-900">
          Conocer el bachillerato
          <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </div>
    </Link>
  );
}
