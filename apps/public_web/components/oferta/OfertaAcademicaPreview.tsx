import Link from "next/link";
import { BACHILLERATOS } from "@/lib/bachilleratos";
import { ArrowRightIcon } from "@/components/icons";
import { BachilleratoCard } from "./BachilleratoCard";

export function OfertaAcademicaPreview() {
  const destacados = BACHILLERATOS.slice(0, 3);

  return (
    <section id="oferta-academica" className="py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-2xl">
          <span className="text-sm font-bold uppercase tracking-wide text-accent-500">
            Oferta académica
          </span>
          <h2 className="font-display mt-2 text-3xl font-extrabold text-brand-900 sm:text-4xl">
            Elige el bachillerato que conecta contigo
          </h2>
          <p className="mt-4 text-lg text-brand-700">
            Cinco caminos para desarrollar tus talentos y continuar tu formación:
            Hostelería y Turismo, Idiomas, Diseño Gráfico, Comunicaciones y General.
          </p>
        </div>

        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {destacados.map((b) => (
            <BachilleratoCard key={b.slug} bachillerato={b} />
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/oferta-academica"
            className="focus-ring group inline-flex items-center gap-2 rounded-full bg-brand-800 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-900"
          >
            Ver los cinco bachilleratos
            <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>
      </div>
    </section>
  );
}
