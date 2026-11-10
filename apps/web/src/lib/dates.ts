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
