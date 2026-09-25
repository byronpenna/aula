import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { BachilleratoVisual } from "@/components/oferta/BachilleratoVisual";
import { BachilleratoCard } from "@/components/oferta/BachilleratoCard";
import { ArrowRightIcon, SparkIcon } from "@/components/icons";
import {
  BACHILLERATOS,
  getBachilleratoBySlug,
  getRelatedBachilleratos,
} from "@/lib/bachilleratos";

// Export estático (next.config.ts): exactamente los 5 slugs se generan en build;
// cualquier otra URL bajo /oferta-academica/* no tiene archivo estático y el
// hosting responde 404 real, sin necesidad de reglas de rewrite adicionales.
export function generateStaticParams() {
  return BACHILLERATOS.map((b) => ({ slug: b.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const bachillerato = getBachilleratoBySlug(slug);
  if (!bachillerato) return {};
  return {
    title: bachillerato.seo.title,
    description: bachillerato.seo.description,
    alternates: { canonical: `/oferta-academica/${bachillerato.slug}` },
  };
}

export default async function BachilleratoDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const bachillerato = getBachilleratoBySlug(slug);
  if (!bachillerato) {
    notFound();
  }

  const relacionados = getRelatedBachilleratos(bachillerato.slug);

  return (
    <>
      <Header />
      <main>
        <section className="bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600 py-16">
          <div className="mx-auto max-w-6xl px-6">
            <nav aria-label="Ruta de navegación" className="text-sm text-brand-200">
              <ol className="flex flex-wrap items-center gap-2">
                <li>
                  <a href="/" className="focus-ring rounded hover:text-white">
                    Inicio
                  </a>
                </li>
                <li aria-hidden="true">/</li>
                <li>
                  <a href="/oferta-academica" className="focus-ring rounded hover:text-white">
                    Oferta académica
                  </a>
                </li>
                <li aria-hidden="true">/</li>
                <li aria-current="page" className="text-white">
                  {bachillerato.titulo}
                </li>
              </ol>
            </nav>

            <div className="mt-6 grid gap-10 md:grid-cols-5 md:items-center">
              <div className="md:col-span-3">
                <span className="inline-block text-sm font-bold uppercase tracking-wide text-accent-300">
                  {bachillerato.etiquetaArea}
                </span>
                <h1 className="font-display mt-2 text-3xl font-extrabold text-white sm:text-4xl">
                  {bachillerato.titulo}
                </h1>
                <p className="mt-4 text-lg text-brand-100">{bachillerato.gancho}</p>
                <a
                  href="/#contacto"
                  className="focus-ring group mt-6 inline-flex items-center gap-2 rounded-full bg-accent-400 px-6 py-3.5 text-sm font-bold text-brand-900 shadow-lg shadow-accent-500/20 transition-transform hover:-translate-y-0.5 hover:bg-accent-300"
                >
                  Solicitar información
                  <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </a>
              </div>
              <div className="md:col-span-2">
                <BachilleratoVisual area={bachillerato.area} variant="hero" />
              </div>
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="mx-auto max-w-3xl px-6">
            <h2 className="font-display text-2xl font-bold text-brand-900">En pocas palabras</h2>
            <p className="mt-4 text-lg leading-relaxed text-brand-700">{bachillerato.resumen}</p>

            <div className="mt-6 flex flex-wrap gap-2">
              {bachillerato.intereses.map((interes) => (
                <span
                  key={interes}
                  className="rounded-full bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700"
                >
                  {interes}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-brand-50 py-16">
          <div className="mx-auto max-w-5xl px-6">
            <h2 className="font-display text-2xl font-bold text-brand-900">Lo que explorarás</h2>
            <p className="mt-2 max-w-2xl text-sm text-brand-600">
              Áreas que podrías explorar — propuesta editorial sujeta a confirmación del plan de
              estudios oficial.
            </p>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {bachillerato.areasExplorar.map((area) => (
                <div
                  key={area}
                  className="flex items-start gap-3 rounded-xl bg-white p-4 shadow-sm ring-1 ring-brand-100"
                >
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-800 text-accent-400">
                    <SparkIcon className="h-4 w-4" />
                  </span>
                  <p className="text-sm font-medium text-brand-800">{area}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="mx-auto max-w-5xl px-6">
            <h2 className="font-display text-2xl font-bold text-brand-900">Aprender haciendo</h2>
            <p className="mt-2 max-w-2xl text-sm text-brand-600">
              Ejemplos de proyectos — ideas ilustrativas, no evidencia de actividades ya realizadas.
            </p>
            <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {bachillerato.ejemplosProyectos.map((proyecto) => (
                <li
                  key={proyecto}
                  className="rounded-xl border border-dashed border-brand-200 p-4 text-sm text-brand-700"
                >
                  {proyecto}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="bg-brand-50 py-16">
          <div className="mx-auto max-w-3xl px-6">
            <h2 className="font-display text-2xl font-bold text-brand-900">
              Después del bachillerato
            </h2>
            <p className="mt-2 text-sm text-brand-600">
              Áreas de continuidad formativa posible, sujetas a los requisitos de ingreso de cada
              institución.
            </p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {bachillerato.continuidad.map((area) => (
                <li
                  key={area}
                  className="rounded-full bg-white px-3 py-1.5 text-sm font-medium text-brand-700 ring-1 ring-brand-100"
                >
                  {area}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="py-16">
          <div className="mx-auto max-w-3xl px-6">
            <h2 className="font-display text-2xl font-bold text-brand-900">
              Preguntas frecuentes
            </h2>
            <dl className="mt-6 divide-y divide-brand-100">
              <div className="py-4">
                <dt className="font-semibold text-brand-900">¿Qué asignaturas incluye?</dt>
                <dd className="mt-1 text-sm text-brand-600">
                  El plan de estudios oficial está en revisión por la dirección académica.
                  Escríbenos y con gusto te compartimos el detalle vigente.
                </dd>
              </div>
              <div className="py-4">
                <dt className="font-semibold text-brand-900">
                  ¿Cómo puedo conocer los requisitos de inscripción?
                </dt>
                <dd className="mt-1 text-sm text-brand-600">
                  Contáctanos y te orientamos sobre el proceso de admisión vigente.
                </dd>
              </div>
              <div className="py-4">
                <dt className="font-semibold text-brand-900">
                  ¿Dónde puedo solicitar más información?
                </dt>
                <dd className="mt-1 text-sm text-brand-600">
                  Escríbenos por{" "}
                  <a href="/#contacto" className="focus-ring rounded underline">
                    nuestros canales de contacto
                  </a>{" "}
                  y te responderemos con gusto.
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="bg-brand-900 py-16">
          <div className="mx-auto max-w-6xl px-6 text-center">
            <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">
              ¿Listo para dar el siguiente paso?
            </h2>
            <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
              <a
                href="/#contacto"
                className="focus-ring rounded-full bg-accent-400 px-6 py-3 text-sm font-bold text-brand-900 hover:bg-accent-300"
              >
                Solicitar información
              </a>
              <Link
                href="/oferta-academica"
                className="focus-ring rounded-full px-6 py-3 text-sm font-semibold text-white ring-1 ring-inset ring-white/30 hover:bg-white/10"
              >
                Volver a la oferta
              </Link>
            </div>
          </div>
        </section>

        <section className="py-16">
          <div className="mx-auto max-w-6xl px-6">
            <h2 className="font-display text-xl font-bold text-brand-900">
              Otros bachilleratos que podrían interesarte
            </h2>
            <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {relacionados.map((b) => (
                <BachilleratoCard key={b.slug} bachillerato={b} />
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
