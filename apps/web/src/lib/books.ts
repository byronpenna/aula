// Compartido entre BooksPage/BookDetailPage/MyBooksPage/BooksAdminPage, mismo
// criterio que lib/billing.ts: etiquetas de estado/método en un solo lugar.
export const PURCHASE_STATUS_LABEL: Record<string, string> = {
  pending: "Pendiente",
  paid: "Pagada",
  failed: "Rechazada",
  cancelled: "Cancelada",
};

export const PURCHASE_STATUS_CLASS: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  paid: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  failed: "bg-red-50 text-red-700 ring-red-200",
  cancelled: "bg-slate-100 text-slate-600 ring-slate-200",
};

export const PURCHASE_METHOD_LABEL: Record<string, string> = {
  colecturia: "Colecturía",
  wompi: "Wompi",
};
