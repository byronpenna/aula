// Formato de fecha consistente en toda la plataforma: dd/mm/yyyy siempre,
// construido a mano (nunca con las opciones de Intl.DateTimeFormat) porque el
// orden día/mes/año y el separador de Intl varían según la variante exacta
// del locale ("es-ES" no formatea igual que "es-419") y no hay forma de
// pedirle a Intl "dd/mm/yyyy" literal — esto sí lo garantiza siempre. Antes de
// esto, varias pantallas usaban `Date.toLocaleString()` crudo (dependiente del
// idioma del sistema operativo) o `Intl.DateTimeFormat` con `dateStyle` (que
// escribe el mes en palabras, no en número).
function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function formatDdMmYyyy(d: Date): string {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${formatDdMmYyyy(d)}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// Hora local de un datetime ISO completo (due_at de una tarea), como "HH:MM".
export function extractTimeFromIso(iso: string): string {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

// El backend serializa `time` como "HH:MM:SS" — para mostrarla o para un
// <input type="time"> (que espera "HH:MM") basta la parte HH:MM.
export function formatTimeOnly(value: string): string {
  return value.slice(0, 5);
}

// `new Date("2026-03-15")` se interpreta como medianoche UTC (ISO 8601 fecha
// sola), así que en un colegio con huso horario negativo (America/El_Salvador,
// UTC-6) los getters locales (getDate/getMonth) devuelven el día anterior —
// por eso una fecha "sin hora" (event_date de CourseCalendarEvent, starts_on/
// ends_on, o cualquier "YYYY-MM-DD" del backend) siempre se parsea a mano
// aquí, nunca con `new Date(str)` directo.
export function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function formatDateOnly(value: string): string {
  return formatDdMmYyyy(parseDateOnly(value));
}

const MONTH_ABBREV = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

// Día y mes abreviado por separado, solo para la insignia visual de dos
// líneas del calendario del curso (número de día grande y mes debajo) — ese
// widget no es "texto con formato de fecha", es un elemento de diseño; nunca
// se usa para mostrar una fecha como texto corrido (para eso, formatDateOnly).
export function formatDateParts(value: string): { day: string; month: string } {
  const parsed = parseDateOnly(value);
  return { day: String(parsed.getDate()), month: MONTH_ABBREV[parsed.getMonth()] };
}
