// Compartido entre StudentDetailPage.tsx (solo lectura) y BillingAdminPage.tsx
// (donde se registran/anulan pagos) para no duplicar las mismas etiquetas.
export const EFFECTIVE_STATUS_LABEL: Record<string, string> = {
  paid: "Pagada",
  pending: "Pendiente",
  overdue: "En mora",
};

export const EFFECTIVE_STATUS_CLASS: Record<string, string> = {
  paid: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  pending: "bg-amber-50 text-amber-700 ring-amber-200",
  overdue: "bg-red-50 text-red-700 ring-red-200",
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
};
