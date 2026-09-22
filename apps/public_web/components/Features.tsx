import { BookIcon, HeartIcon, SparkIcon, UsersIcon } from "./icons";

const FEATURES = [
  {
    icon: BookIcon,
    title: "Preescolar a bachillerato",
    description:
      "Un plan de estudios continuo, alineado entre niveles, que acompaña a cada estudiante en todo su recorrido escolar.",
  },
  {
    icon: UsersIcon,
    title: "Docentes cercanos",
    description:
      "Grupos reducidos y seguimiento personalizado, con comunicación constante entre docentes, familias y estudiantes.",
  },
  {
    icon: SparkIcon,
    title: "Tecnología educativa",
    description:
      "Plataforma propia (Aula Virtual) para tareas, calificaciones y comunicación, disponible para toda la comunidad.",
  },
  {
    icon: HeartIcon,
    title: "Bienestar y valores",
    description:
      "Formación integral con énfasis en valores, bienestar emocional y actividades artísticas, deportivas y culturales.",
  },
];

export function Features() {
  return (
    <section id="programas" className="bg-brand-50 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-2xl">
          <span className="text-sm font-bold uppercase tracking-wide text-accent-500">
            Nuestra propuesta
          </span>
          <h2 className="font-display mt-2 text-3xl font-extrabold text-brand-900 sm:text-4xl">
            Una experiencia educativa completa
          </h2>
          <p className="mt-4 text-lg text-brand-700">
            Combinamos rigor académico, acompañamiento humano y herramientas digitales para que
            cada estudiante llegue lejos.
          </p>
        </div>

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-2xl bg-white p-6 shadow-sm ring-1 ring-brand-100 transition-shadow hover:shadow-md"
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-800 text-accent-400 transition-colors group-hover:bg-accent-400 group-hover:text-brand-900">
                <feature.icon className="h-6 w-6" />
              </span>
              <h3 className="font-display mt-4 text-base font-bold text-brand-900">
                {feature.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-brand-600">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
