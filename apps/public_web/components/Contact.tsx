import {
  SCHOOL_ADDRESS,
  SCHOOL_FACEBOOK_URL,
  SCHOOL_GOOGLE_MAPS_URL,
  SCHOOL_PHONE,
  SCHOOL_PHONE_HREF,
  SCHOOL_SCHEDULE,
  SCHOOL_TIKTOK_URL,
  SCHOOL_WAZE_URL,
} from "@/lib/config";
import {
  ClockIcon,
  FacebookIcon,
  MapPinIcon,
  NavigationIcon,
  PhoneIcon,
  TikTokIcon,
} from "./icons";

export function Contact() {
  return (
    <section className="bg-brand-50 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <div className="max-w-2xl">
          <span className="text-sm font-bold uppercase tracking-wide text-accent-500">
            Visítanos
          </span>
          <h2 className="font-display mt-2 text-3xl font-extrabold text-brand-900 sm:text-4xl">
            Encuéntranos en Apopa
          </h2>
        </div>

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          <div className="flex gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-brand-100">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-800 text-accent-400">
              <MapPinIcon className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-display text-sm font-bold text-brand-900">Dirección</h3>
              <p className="mt-1 text-sm leading-relaxed text-brand-600">{SCHOOL_ADDRESS}</p>
              <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold">
                <a
                  href={SCHOOL_WAZE_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="focus-ring inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-brand-700 hover:bg-brand-100"
                >
                  <NavigationIcon className="h-3.5 w-3.5" />
                  Waze
                </a>
                <a
                  href={SCHOOL_GOOGLE_MAPS_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="focus-ring inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1.5 text-brand-700 hover:bg-brand-100"
                >
                  <MapPinIcon className="h-3.5 w-3.5" />
                  Google Maps
                </a>
              </div>
            </div>
          </div>

          <div className="flex gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-brand-100">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-800 text-accent-400">
              <PhoneIcon className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-display text-sm font-bold text-brand-900">Teléfono</h3>
              <a
                href={`tel:${SCHOOL_PHONE_HREF}`}
                className="focus-ring mt-1 block rounded text-sm text-brand-600 hover:text-brand-800"
              >
                {SCHOOL_PHONE}
              </a>

              <h3 className="font-display mt-4 flex items-center gap-1.5 text-sm font-bold text-brand-900">
                <ClockIcon className="h-4 w-4 text-brand-700" />
                Horario de atención
              </h3>
              <p className="mt-1 text-sm text-brand-600">
                {SCHOOL_SCHEDULE ?? "Por confirmar — contáctanos por teléfono o redes sociales."}
              </p>
            </div>
          </div>

          <div className="flex gap-4 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-brand-100">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-800 text-accent-400">
              <FacebookIcon className="h-5 w-5" />
            </span>
            <div>
              <h3 className="font-display text-sm font-bold text-brand-900">Síguenos</h3>
              <p className="mt-1 text-sm text-brand-600">
                Noticias, avisos y vida estudiantil en nuestras redes.
              </p>
              <div className="mt-3 flex gap-3">
                <a
                  href={SCHOOL_FACEBOOK_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label="Facebook del colegio"
                  className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-700 hover:bg-brand-100"
                >
                  <FacebookIcon className="h-4 w-4" />
                </a>
                <a
                  href={SCHOOL_TIKTOK_URL}
                  target="_blank"
                  rel="noreferrer noopener"
                  aria-label="TikTok del colegio"
                  className="focus-ring inline-flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-brand-700 hover:bg-brand-100"
                >
                  <TikTokIcon className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
