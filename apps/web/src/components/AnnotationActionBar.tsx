import { useState } from "react";
import { HIGHLIGHT_COLORS } from "../lib/bookAnnotations";
import { ErrorState } from "./States";

interface Props {
  selectedText: string;
  isSaving: boolean;
  error?: unknown;
  onHighlight: (color: string) => void;
  onSaveNote: (body: string) => void;
  onCancel: () => void;
}

// Barra que aparece al seleccionar texto en el lector (PDF o EPUB): elegir un
// color para resaltar, o escribir una nota sobre esa misma selección. Vive
// como una fila más del layout (no superpuesta) para no complicar el cálculo
// de posición cerca de una selección que puede cruzar dos páginas (spread) o
// vivir dentro del iframe de epub.js.
export function AnnotationActionBar({ selectedText, isSaving, error, onHighlight, onSaveNote, onCancel }: Props) {
  const [composingNote, setComposingNote] = useState(false);
  const [noteBody, setNoteBody] = useState("");

  if (composingNote) {
    return (
      <div className="shrink-0 space-y-2 border-t border-slate-800 bg-slate-950 p-3 text-white">
        <p className="truncate text-xs text-slate-400">“{selectedText}”</p>
        <textarea
          autoFocus
          value={noteBody}
          onChange={(e) => setNoteBody(e.target.value)}
          rows={2}
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
    <div className="flex shrink-0 flex-wrap items-center gap-2 border-t border-slate-800 bg-slate-950 p-3 text-white">
      <span className="max-w-[40%] min-w-0 truncate text-xs text-slate-400">“{selectedText}”</span>
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
        className="focus-ring ml-auto rounded-md px-3 py-1.5 text-sm text-slate-400 hover:bg-slate-800"
      >
        Cancelar
      </button>
      {Boolean(error) && (
        <div className="w-full">
          <ErrorState error={error} />
        </div>
      )}
    </div>
  );
}
