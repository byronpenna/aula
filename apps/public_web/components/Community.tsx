import Image from "next/image";

const ACTIVITIES = [
  "Banda de paz y palillonas",
  "Danza folclórica",
  "Actos cívicos y honores a la bandera",
  "Educación física y deportes",
  "Formación en valores",
  "Actividades culturales",
];

export function Community() {
  return (
    <section id="comunidad" className="py-20">
      <div className="mx-auto grid max-w-6xl gap-12 px-6 lg:grid-cols-2 lg:items-center">
        <div>
          <span className="text-sm font-bold uppercase tracking-wide text-accent-500">
            Vida estudiantil
          </span>
          <h2 className="font-display mt-2 text-3xl font-extrabold text-brand-900 sm:text-4xl">
            Una comunidad que crece junta
          </h2>
          <p className="mt-4 text-lg text-brand-700">
            Más allá del salón de clases, en nuestro colegio cada estudiante encuentra un espacio
            para participar, representar a la institución y desarrollar nuevas habilidades.
          </p>

          <ul className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {ACTIVITIES.map((activity) => (
              <li key={activity} className="flex items-center gap-2.5 text-sm text-brand-800">
                <span className="h-2 w-2 shrink-0 rounded-full bg-accent-400" />
                {activity}
              </li>
            ))}
          </ul>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="relative col-span-2 h-44 overflow-hidden rounded-2xl">
            <Image
              src="/img/img2.jpg"
              alt="Estudiantes en danza folclórica durante un acto cívico"
              fill
              sizes="(min-width: 1024px) 560px, 100vw"
              className="object-cover"
            />
          </div>
          <div className="relative h-36 overflow-hidden rounded-2xl">
            <Image
              src="/img/img_promo_banda.jpg"
              alt="Banda de paz y palillonas del colegio"
              fill
              sizes="(min-width: 1024px) 272px, 50vw"
              className="object-cover"
            />
          </div>
          <div className="relative h-36 overflow-hidden rounded-2xl">
            <Image
              src="/img/img1.jpg"
              alt="Estudiantes del colegio con uniforme institucional"
              fill
              sizes="(min-width: 1024px) 272px, 50vw"
              className="object-cover"
            />
          </div>
          <div className="relative col-span-2 h-32 overflow-hidden rounded-2xl">
            <Image
              src="/img/img3.jpg"
              alt="Estudiantes en honores a la bandera"
              fill
              sizes="(min-width: 1024px) 560px, 100vw"
              className="object-cover"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
