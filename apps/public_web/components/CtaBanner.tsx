import { AULA_VIRTUAL_URL, SCHOOL_SHORT_NAME } from "@/lib/config";
import { ArrowRightIcon } from "./icons";

export function CtaBanner() {
  return (
    <section className="relative overflow-hidden bg-brand-900 py-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-accent-400/15 blur-3xl"
      />
      <div className="relative mx-auto flex max-w-5xl flex-col items-center gap-6 px-6 text-center">
        <h2 className="font-display text-2xl font-extrabold text-white sm:text-3xl">
          ¿Ya eres parte de la comunidad {SCHOOL_SHORT_NAME}?
        </h2>
        <p className="max-w-xl text-brand-100">
          Ingresa a Aula Virtual para consultar tareas, calificaciones, asistencia y la
          comunicación con el colegio, todo en un solo lugar.
        </p>
        <a
          href={AULA_VIRTUAL_URL}
          className="focus-ring group inline-flex items-center gap-2 rounded-full bg-accent-400 px-7 py-3.5 text-sm font-bold text-brand-900 shadow-lg shadow-accent-500/20 transition-transform hover:-translate-y-0.5 hover:bg-accent-300"
        >
          Ir a Aula Virtual
          <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </a>
      </div>
    </section>
  );
}
