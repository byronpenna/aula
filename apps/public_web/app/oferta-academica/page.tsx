import { Suspense } from "react";
import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { CatalogoInteractivo } from "@/components/oferta/CatalogoInteractivo";
import { BACHILLERATOS } from "@/lib/bachilleratos";

export const metadata: Metadata = {
  title: "Oferta académica | Colegio Coronel Francisco Linares",
  description:
    "Cada estudiante tiene talentos e intereses únicos. Conoce nuestras opciones de bachillerato y descubre un camino para seguir aprendiendo, creando y creciendo.",
  alternates: { canonical: "/oferta-academica" },
};

export default function OfertaAcademicaPage() {
  return (
    <>
      <Header />
      <main>
        <section className="bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600 py-16">
          <div className="mx-auto max-w-6xl px-6">
            <nav aria-label="Ruta de navegación" className="text-sm text-brand-200">
              <ol className="flex items-center gap-2">
                <li>
                  <a href="/" className="focus-ring rounded hover:text-white">
                    Inicio
                  </a>
                </li>
                <li aria-hidden="true">/</li>
                <li aria-current="page" className="text-white">
                  Oferta académica
                </li>
              </ol>
            </nav>

            <span className="mt-4 inline-block text-sm font-bold uppercase tracking-wide text-accent-300">
              Oferta académica
            </span>
            <h1 className="font-display mt-2 max-w-2xl text-3xl font-extrabold text-white sm:text-4xl">
              Explora nuestros bachilleratos
            </h1>
            <p className="mt-4 max-w-2xl text-lg text-brand-100">
              Descubre diferentes caminos para desarrollar tus talentos y continuar tu formación.
            </p>
          </div>
        </section>

        <section className="py-16">
          <div className="mx-auto max-w-6xl px-6">
            <Suspense>
              <CatalogoInteractivo bachilleratos={BACHILLERATOS} />
            </Suspense>
          </div>
        </section>

        <section className="bg-brand-50 py-14">
          <div className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-6 text-center">
            <h2 className="font-display text-xl font-bold text-brand-900 sm:text-2xl">
              ¿Aún no sabes cuál elegir?
            </h2>
            <p className="text-brand-700">Nuestro equipo puede orientarte.</p>
            <a
              href="/#contacto"
              className="focus-ring rounded-full bg-brand-800 px-6 py-3 text-sm font-semibold text-white hover:bg-brand-900"
            >
              Contactar al colegio
            </a>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
