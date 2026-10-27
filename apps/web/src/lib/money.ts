const MONTH_NAMES = [
  "ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic",
];

export function formatMoney(amount: string | number): string {
  return new Intl.NumberFormat("es-SV", { style: "currency", currency: "USD" }).format(
    Number(amount),
  );
}

// "YYYY-MM-DD" sin pasar por Date (billing, sección nueva): evita el corrimiento
// de un día que Date + toLocaleDateString introduce según la zona horaria del
// navegador.
export function formatMonth(dueDate: string): string {
  const [year, month] = dueDate.split("-");
  return `${MONTH_NAMES[Number(month) - 1]} ${year}`;
}
