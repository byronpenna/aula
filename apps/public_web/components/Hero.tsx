import Image from "next/image";
import { AULA_VIRTUAL_URL, SCHOOL_NAME } from "@/lib/config";
import { ArrowRightIcon, SparkIcon } from "./icons";

export function Hero() {
  return (
    <section
      id="top"
      className="relative overflow-hidden bg-gradient-to-br from-brand-900 via-brand-800 to-brand-600"
    >
      {/* Formas decorativas: solo gradientes/blur, sin imágenes externas. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-accent-400/25 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 left-0 h-80 w-80 rounded-full bg-brand-400/30 blur-3xl"
      />

      <div className="relative mx-auto grid max-w-6xl gap-12 px-6 py-20 md:grid-cols-2 md:items-center md:py-28">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-accent-300 ring-1 ring-inset ring-white/20">
            <SparkIcon className="h-3.5 w-3.5" />
            Admisiones 2027 abiertas
          </span>

          <h1 className="font-display mt-5 text-4xl font-extrabold leading-tight text-white sm:text-5xl">
            Formamos personas íntegras para un mundo en cambio
          </h1>

          <p className="mt-5 max-w-md text-lg leading-relaxed text-brand-100">
            En {SCHOOL_NAME} acompañamos a cada estudiante desde preescolar hasta bachillerato,
            bajo el lema <span className="text-accent-300">Dios, Patria y Ciencia</span>, con una
            comunidad cercana y docentes comprometidos.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <a
              href={AULA_VIRTUAL_URL}
              className="focus-ring group inline-flex items-center gap-2 rounded-full bg-accent-400 px-6 py-3.5 text-sm font-bold text-brand-900 shadow-lg shadow-accent-500/20 transition-transform hover:-translate-y-0.5 hover:bg-accent-300"
            >
              Aula Virtual
              <ArrowRightIcon className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </a>
            <a
              href="#programas"
              className="focus-ring rounded-full px-6 py-3.5 text-sm font-semibold text-white ring-1 ring-inset ring-white/30 transition-colors hover:bg-white/10"
            >
              Conoce el colegio
            </a>
          </div>
        </div>

        <div className="relative hidden md:block">
          <div className="absolute inset-0 rotate-3 rounded-3xl bg-white/10" />
          <div className="relative overflow-hidden rounded-3xl bg-white p-2 shadow-2xl">
            <Image
              src="/img/img_promo_matricula.jpg"
              alt="Matrícula 2027 abierta en Colegio Coronel Francisco Linares"
              width={1290}
              height={482}
              className="w-full rounded-2xl object-cover"
              priority
            />
          </div>
        </div>
      </div>
    </section>
  );
}
