"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AREAS,
  searchBachilleratos,
  type AreaInteres,
  type Bachillerato,
} from "@/lib/bachilleratos";
import { BachilleratoCard } from "./BachilleratoCard";

export function CatalogoInteractivo({ bachilleratos }: { bachilleratos: Bachillerato[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const areaParam = searchParams.get("area");
  const activeArea: AreaInteres | null =
    (AREAS.find((a) => a.value === areaParam)?.value as AreaInteres | undefined) ?? null;

  const [query, setQuery] = useState("");

  function setArea(area: AreaInteres | null) {
    const params = new URLSearchParams(searchParams.toString());
    if (area) {
      params.set("area", area);
    } else {
      params.delete("area");
    }
    const qs = params.toString();
    router.replace(qs ? `/oferta-academica?${qs}` : "/oferta-academica", { scroll: false });
  }

  const filtered = useMemo(() => {
    const byArea = activeArea
      ? bachilleratos.filter((b) => b.area === activeArea)
      : bachilleratos;
    return searchBachilleratos(byArea, query);
  }, [bachilleratos, activeArea, query]);

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por área de interés">
          <button
            type="button"
            onClick={() => setArea(null)}
            aria-pressed={activeArea === null}
            className={`focus-ring rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
              activeArea === null
                ? "bg-brand-800 text-white"
                : "bg-brand-50 text-brand-700 hover:bg-brand-100"
            }`}
          >
            Todos
          </button>
          {AREAS.map((area) => (
            <button
              key={area.value}
              type="button"
              onClick={() => setArea(area.value)}
              aria-pressed={activeArea === area.value}
              className={`focus-ring rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                activeArea === area.value
                  ? "bg-brand-800 text-white"
                  : "bg-brand-50 text-brand-700 hover:bg-brand-100"
              }`}
            >
              {area.label}
            </button>
          ))}
        </div>

        <label className="sr-only" htmlFor="buscar-bachillerato">
          Buscar por nombre o interés
        </label>
        <input
          id="buscar-bachillerato"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar por nombre o interés…"
          className="focus-ring w-full rounded-full border border-brand-200 px-4 py-2 text-sm sm:w-64"
        />
      </div>

      <p aria-live="polite" className="mt-4 text-sm text-brand-500">
        Mostrando {filtered.length} de {bachilleratos.length} opciones
      </p>

      {filtered.length === 0 ? (
        <div className="mt-8 rounded-2xl bg-brand-50 p-8 text-center">
          <p className="text-brand-700">No encontramos bachilleratos con ese criterio.</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setArea(null);
            }}
            className="focus-ring mt-4 rounded-full bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-900"
          >
            Limpiar filtros
          </button>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((b) => (
            <BachilleratoCard key={b.slug} bachillerato={b} />
          ))}
        </div>
      )}
    </div>
  );
}
