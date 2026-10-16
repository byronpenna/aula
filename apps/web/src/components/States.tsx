import type { ReactNode } from "react";
import { ApiError } from "../lib/apiClient";

// Pantallas reales de carga/vacío/error/permiso denegado/sin conexión (sección 10).
// Nunca mocks silenciosos: cada estado refleja una respuesta real del servidor.

export function LoadingState({ label = "Cargando…" }: { label?: string }) {
  return (
    <div role="status" className="flex items-center gap-2 p-6 text-brand-600">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-200 border-t-brand-700" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-brand-200 p-6 text-center text-brand-600">
      <p className="font-display font-semibold text-brand-900">{title}</p>
      {description && <p className="mt-1 text-sm">{description}</p>}
    </div>
  );
}

export function ForbiddenState({ message }: { message?: string }) {
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-6 text-amber-800" role="alert">
      <p className="font-display font-semibold">Acceso no autorizado</p>
      <p className="mt-1 text-sm">{message ?? "No tienes permiso para ver este contenido."}</p>
    </div>
  );
}

export function OfflineState() {
  return (
    <div className="rounded-xl border border-brand-100 bg-brand-50 p-6 text-brand-700" role="alert">
      <p className="font-display font-semibold text-brand-900">Sin conexión</p>
      <p className="mt-1 text-sm">
        No se pudo contactar al servidor. Tus cambios podrían no haberse guardado.
      </p>
    </div>
  );
}

export function ErrorState({ error, children }: { error: unknown; children?: ReactNode }) {
  if (error instanceof ApiError) {
    if (error.status === 403 || error.status === 404) {
      return <ForbiddenState message={error.message} />;
    }
    if (error.status === 0) {
      return <OfflineState />;
    }
  }
  const message = error instanceof Error ? error.message : "Ocurrió un error inesperado.";
  return (
    <div className="rounded-xl border border-red-300 bg-red-50 p-6 text-red-800" role="alert">
      <p className="font-display font-semibold">No se pudo completar la operación</p>
      <p className="mt-1 text-sm">{message}</p>
      {children}
    </div>
  );
}
