import Image from "next/image";
import {
  AULA_VIRTUAL_URL,
  SCHOOL_ADDRESS,
  SCHOOL_FACEBOOK_URL,
  SCHOOL_NAME,
  SCHOOL_PHONE,
  SCHOOL_PHONE_HREF,
  SCHOOL_TIKTOK_URL,
} from "@/lib/config";
import { FacebookIcon, TikTokIcon } from "./icons";

export function Footer() {
  return (
    <footer id="contacto" className="bg-brand-900 py-14 text-brand-200">
      <div className="mx-auto grid max-w-6xl gap-10 px-6 sm:grid-cols-3">
        <div>
          <div className="flex items-center gap-2.5">
            <Image
              src="/img/logo.jpg"
              alt={SCHOOL_NAME}
              width={36}
              height={36}
              className="h-9 w-9 rounded-full object-cover"
            />
            <span className="font-display text-base font-bold text-white">{SCHOOL_NAME}</span>
          </div>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-brand-300">
            Educación integral desde preescolar hasta bachillerato, bajo el lema Dios, Patria y
            Ciencia.
          </p>
          <div className="mt-4 flex gap-3">
            <a
              href={SCHOOL_FACEBOOK_URL}
              target="_blank"
              rel="noreferrer noopener"
              aria-label="Facebook del colegio"
              className="focus-ring inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-brand-200 hover:bg-white/20 hover:text-white"
            >
              <FacebookIcon className="h-4 w-4" />
            </a>
            <a
              href={SCHOOL_TIKTOK_URL}
              target="_blank"
              rel="noreferrer noopener"
              aria-label="TikTok del colegio"
              className="focus-ring inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-brand-200 hover:bg-white/20 hover:text-white"
            >
              <TikTokIcon className="h-4 w-4" />
            </a>
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-white">Contacto</p>
          <ul className="mt-3 space-y-2 text-sm text-brand-300">
            <li>{SCHOOL_ADDRESS}</li>
            <li>
              <a href={`tel:${SCHOOL_PHONE_HREF}`} className="focus-ring rounded hover:text-white">
                {SCHOOL_PHONE}
              </a>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold text-white">Enlaces</p>
          <ul className="mt-3 space-y-2 text-sm text-brand-300">
            <li>
              <a href="/#programas" className="focus-ring rounded hover:text-white">
                Programas
              </a>
            </li>
            <li>
              <a href="/oferta-academica" className="focus-ring rounded hover:text-white">
                Oferta académica
              </a>
            </li>
            <li>
              <a href="/#comunidad" className="focus-ring rounded hover:text-white">
                Comunidad
              </a>
            </li>
            <li>
              <a href="/noticias" className="focus-ring rounded hover:text-white">
                Noticias
              </a>
            </li>
            <li>
              <a href={AULA_VIRTUAL_URL} className="focus-ring rounded hover:text-white">
                Aula Virtual
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="mx-auto mt-10 max-w-6xl border-t border-white/10 px-6 pt-6 text-xs text-brand-400">
        © {new Date().getFullYear()} {SCHOOL_NAME}. Todos los derechos reservados.
      </div>
    </footer>
  );
}
