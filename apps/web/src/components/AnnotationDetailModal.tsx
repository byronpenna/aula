import { useState } from "react";
import type { BookAnnotation } from "../lib/types";
import { HIGHLIGHT_COLORS } from "../lib/bookAnnotations";
import { ErrorState } from "./States";
import { CloseIcon } from "./icons";

interface Props {
  annotation: BookAnnotation;
  onClose: () => void;
  onSave: (patch: { body?: string; is_shared?: boolean }) => void;
  onDelete: () => void;
  isSaving: boolean;
  isDeleting: boolean;
  error?: unknown;
}

// Ver/editar una nota o resaltado existente. Si no es del usuario actual (una
// compartida por otro alumno que también compró el libro), se muestra en solo
// lectura — el backend ya rechaza cualquier intento de editar/borrar lo ajeno
// (ver books/service.py::update_book_annotation), esto es solo UX.
export function AnnotationDetailModal({ annotation, onClose, onSave, onDelete, isSaving, isDeleting, error }: Props) {
  const [body, setBody] = useState(annotation.body ?? "");
  const [isShared, setIsShared] = useState(annotation.is_shared);
  const colorLabel = HIGHLIGHT_COLORS.find((c) => c.key === annotation.color)?.label;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-brand-900">
            {annotation.kind === "highlight" ? `Resaltado${colorLabel ? ` (${colorLabel})` : ""}` : "Nota"}
          </p>
          <button
            type="button"
            onClick={onClose}
            title="Cerrar"
            aria-label="Cerrar"
            className="focus-ring rounded-md p-1 text-slate-500 hover:bg-slate-100"
          >
            <CloseIcon />
          </button>
        </div>

        {!annotation.is_mine && (
          <p className="mb-2 text-xs text-slate-500">Compartida por {annotation.author_name}</p>
        )}

        {annotation.is_mine ? (
          <>
            {(annotation.kind === "note" || annotation.body) && (
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={3}
                className="focus-ring mb-3 w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
                placeholder={annotation.kind === "highlight" ? "Comentario (opcional)" : "Tu nota…"}
              />
            )}
            <label className="mb-3 flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={isShared}
                onChange={(e) => setIsShared(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Compartir con otros alumnos que compraron este libro
            </label>
            {Boolean(error) && <ErrorState error={error} />}
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={onDelete}
                className="focus-ring rounded-md px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-60"
              >
                Eliminar
              </button>
              <button
                type="button"
                disabled={isSaving || (annotation.kind === "note" && !body.trim())}
                onClick={() => onSave({ body: body.trim(), is_shared: isShared })}
                className="focus-ring rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                Guardar
              </button>
            </div>
          </>
        ) : (
          annotation.body && <p className="whitespace-pre-wrap text-sm text-slate-700">{annotation.body}</p>
        )}
      </div>
    </div>
  );
}
