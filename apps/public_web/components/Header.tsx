import Image from "next/image";
import Link from "next/link";
import { AULA_VIRTUAL_URL, SCHOOL_SHORT_NAME } from "@/lib/config";

const NAV_LINKS = [
  { href: "/#programas", label: "Programas" },
  { href: "/#comunidad", label: "Comunidad" },
  { href: "/noticias", label: "Noticias" },
  { href: "/#contacto", label: "Contacto" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-brand-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <Link href="#top" className="focus-ring flex items-center gap-2.5 rounded-md">
          <Image
            src="/img/logo.jpg"
            alt={SCHOOL_SHORT_NAME}
            width={44}
            height={44}
            className="h-11 w-11 rounded-full object-cover shadow-sm"
            priority
          />
          <span className="font-display text-lg font-bold text-brand-900">{SCHOOL_SHORT_NAME}</span>
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="focus-ring rounded text-sm font-medium text-brand-700 transition-colors hover:text-brand-900"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <a
          href={AULA_VIRTUAL_URL}
          className="focus-ring inline-flex items-center gap-1.5 rounded-full bg-brand-800 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-900"
        >
          Aula Virtual
        </a>
      </div>
    </header>
  );
}
