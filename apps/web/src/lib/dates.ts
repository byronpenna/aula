// Formato de fecha+hora consistente en español para toda la plataforma (ver
// lib/money.ts::formatMoney para el mismo patrón aplicado a montos). Antes de
// esto, varias pantallas usaban `Date.toLocaleString()` crudo, que depende del
// idioma configurado en el sistema operativo del usuario y puede salir en inglés
// o con un formato distinto en cada pantalla.
const formatter = new Intl.DateTimeFormat("es", {
  dateStyle: "medium",
  timeStyle: "short",
});

export function formatDateTime(iso: string): string {
  return formatter.format(new Date(iso));
}

// `new Date("2026-03-15")` se interpreta como medianoche UTC (ISO 8601 fecha
// sola), así que en un colegio con huso horario negativo (America/El_Salvador,
// UTC-6) los getters locales (getDate/getMonth) devuelven el día anterior —
// por eso una fecha "sin hora" (event_date de CourseCalendarEvent, o cualquier
// "YYYY-MM-DD" del backend) siempre se parsea a mano aquí, nunca con
// `new Date(str)` directo.
export function parseDateOnly(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

const dateOnlyFormatter = new Intl.DateTimeFormat("es", { day: "numeric", month: "short" });
const monthAbbrevFormatter = new Intl.DateTimeFormat("es", { month: "short" });

export function formatDateOnly(value: string): string {
  return dateOnlyFormatter.format(parseDateOnly(value));
}

// Día y mes abreviado por separado (p. ej. para una tarjeta con el número de
// día grande y el mes debajo) — nunca se parte el string ya formateado, el
// orden día/mes de Intl no está garantizado igual en todos los locales.
export function formatDateParts(value: string): { day: string; month: string } {
  const parsed = parseDateOnly(value);
  return {
    day: String(parsed.getDate()),
    month: monthAbbrevFormatter.format(parsed).replace(".", ""),
  };
}
