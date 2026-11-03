import { useState, type CSSProperties } from "react";
import { HIGHLIGHT_COLORS } from "../lib/bookAnnotations";
import { ErrorState } from "./States";

interface Props {
  isSaving: boolean;
  error?: unknown;
  onHighlight: (color: string) => void;
  onSaveNote: (body: string) => void;
  onCancel: () => void;
  style: CSSProperties;
}

// Igual contenido que AnnotationActionBar.tsx (elegir color / escribir una
// nota) pero flotante, anclado cerca del recuadro recién dibujado en vez de
// una barra fija abajo de la pantalla — ver BookPdfReader.tsx. Tiene sentido
// acá porque, a diferencia de una selección de texto en EPUB (que puede
// cruzar varias líneas o incluso dos páginas), un recuadro de PDF es un único
// rectángulo con una posición clara y estable donde anclar el popover.
export function AnnotationFloatingComposer({ isSaving, error, onHighlight, onSaveNote, onCancel, style }: Props) {
  const [composingNote, setComposingNote] = useState(false);
  const [noteBody, setNoteBody] = useState("");

  if (composingNote) {
    return (
      <div
        className="absolute z-40 w-72 space-y-2 rounded-lg border border-slate-700 bg-slate-950 p-3 text-white shadow-xl"
        style={style}
      >
        <textarea
          autoFocus
          value={noteBody}
          onChange={(e) => setNoteBody(e.target.value)}
          rows={3}
          placeholder="Escribe tu nota…"
          className="focus-ring w-full rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-sm text-white placeholder:text-slate-500"
        />
        {Boolean(error) && <ErrorState error={error} />}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="focus-ring rounded-md px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={!noteBody.trim() || isSaving}
            onClick={() => onSaveNote(noteBody.trim())}
            className="focus-ring rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            Guardar nota
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="absolute z-40 flex w-max flex-col gap-2 rounded-lg border border-slate-700 bg-slate-950 p-3 text-white shadow-xl"
      style={style}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-400">Resaltar:</span>
        {HIGHLIGHT_COLORS.map((color) => (
          <button
            key={color.key}
            type="button"
            disabled={isSaving}
            onClick={() => onHighlight(color.key)}
            className={`focus-ring h-7 w-7 rounded-full ring-2 ring-white/40 disabled:opacity-60 ${color.swatchClass}`}
            aria-label={`Resaltar en ${color.label}`}
          />
        ))}
      </div>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          disabled={isSaving}
          onClick={() => setComposingNote(true)}
          className="focus-ring rounded-md border border-slate-700 px-3 py-1.5 text-sm hover:bg-slate-800 disabled:opacity-60"
        >
          Agregar nota
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="focus-ring rounded-md px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-800"
        >
          Cancelar
        </button>
      </div>
      {Boolean(error) && <ErrorState error={error} />}
    </div>
  );
}
