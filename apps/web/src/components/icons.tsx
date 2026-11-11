import type { SVGProps } from "react";

// Set mínimo de íconos de acción (descargar/ver/cerrar/expandir), trazo
// consistente entre sí y con el ícono de menú de AppShell.tsx — no se instaló
// ninguna librería de íconos para esto (cero dependencias nuevas, bundle
// mínimo): son los únicos 4 símbolos que se repiten lo suficiente en tablas y
// listas como para justificar un ícono en vez de texto (sección 4 del skill de
// UX: "íconos coherentes y con significado, no para rellenar espacios"). Cada
// botón que los usa sigue llevando su significado en `aria-label`/`title`, el
// ícono nunca es la única pista.
type IconProps = SVGProps<SVGSVGElement>;

function iconProps(props: IconProps): IconProps {
  return {
    viewBox: "0 0 20 20",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true",
    className: "h-4 w-4",
    ...props,
  };
}

export function DownloadIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M10 3v9m0 0 3.5-3.5M10 12l-3.5-3.5" />
      <path d="M4 14v1.5A1.5 1.5 0 0 0 5.5 17h9a1.5 1.5 0 0 0 1.5-1.5V14" />
    </svg>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M2 10s2.8-5.5 8-5.5S18 10 18 10s-2.8 5.5-8 5.5S2 10 2 10Z" />
      <circle cx="10" cy="10" r="2.25" />
    </svg>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M5 5l10 10M15 5 5 15" />
    </svg>
  );
}

export function ChevronDownIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M5 7.5 10 13l5-5.5" />
    </svg>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M12.5 5 7 10l5.5 5" />
    </svg>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M7.5 5 13 10l-5.5 5" />
    </svg>
  );
}

export function PencilIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M12.3 3.7a1.8 1.8 0 0 1 2.5 0l1.5 1.5a1.8 1.8 0 0 1 0 2.5l-8.6 8.6-4.2 1 1-4.2 8.6-8.6Z" />
      <path d="M11 5l4 4" />
    </svg>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M4 6h12M8 6V4.5A1.5 1.5 0 0 1 9.5 3h1A1.5 1.5 0 0 1 12 4.5V6" />
      <path d="M5.5 6 6.2 16a1.5 1.5 0 0 0 1.5 1.4h4.6a1.5 1.5 0 0 0 1.5-1.4L14.5 6" />
      <path d="M8.3 9v5M11.7 9v5" />
    </svg>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M10 4v12M4 10h12" />
    </svg>
  );
}

export function LinkIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M8.5 11.5a3 3 0 0 0 4.24 0l2-2a3 3 0 0 0-4.24-4.24l-1 1" />
      <path d="M11.5 8.5a3 3 0 0 0-4.24 0l-2 2a3 3 0 0 0 4.24 4.24l1-1" />
    </svg>
  );
}

export function CalendarIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <rect x="3.5" y="4.5" width="13" height="12" rx="1.5" />
      <path d="M3.5 8h13M7 3v3M13 3v3" />
    </svg>
  );
}

export function ImageIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <rect x="3" y="4" width="14" height="12" rx="1.5" />
      <circle cx="7.5" cy="8.5" r="1.25" />
      <path d="M3.8 15.5 8 11l2.5 2.5L14 10l2.7 2.7" />
    </svg>
  );
}

export function ChatIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M3.5 5.5h13v8h-6.5L6.5 16v-2.5h-3Z" />
    </svg>
  );
}

// Burbuja de chat con un teléfono adentro — no es el logo de WhatsApp (se
// mantiene el mismo trazo monocromático del resto del set, nunca un ícono de
// marca a color); el botón que lo usa siempre lleva "WhatsApp" en el texto,
// el ícono nunca es la única pista.
export function WhatsAppIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M3.5 5.5h13v8h-6.5L6.5 16v-2.5h-3Z" />
      <path d="M8.3 8.3c.3-.5 1-.5 1.2 0l.3.6c.1.3 0 .6-.2.8l-.3.3c.3.7.9 1.3 1.6 1.6l.3-.3c.2-.2.5-.3.8-.2l.6.3c.5.2.5.9 0 1.2-.8.5-1.8.4-2.6-.1-.9-.6-1.6-1.3-2.2-2.2-.5-.8-.6-1.8-.1-2.6Z" />
    </svg>
  );
}

export function PollIcon(props: IconProps) {
  return (
    <svg {...iconProps(props)}>
      <path d="M5 16V9M10 16V4M15 16v-6" />
    </svg>
  );
}
