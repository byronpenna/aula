import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { NewsList } from "@/components/NewsList";

export default function NoticiasPage() {
  return (
    <>
      <Header />
      <main>
        <section className="py-20">
          <div className="mx-auto max-w-3xl px-6">
            <span className="text-sm font-bold uppercase tracking-wide text-accent-500">
              Noticias
            </span>
            <h1 className="font-display mt-2 text-3xl font-extrabold text-brand-900 sm:text-4xl">
              Noticias del colegio
            </h1>
            <p className="mt-4 text-lg text-brand-700">
              Avisos, logros y novedades de Colegio Coronel Francisco Linares.
            </p>

            <NewsList />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
