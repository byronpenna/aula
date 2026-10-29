import { useEffect, useRef, useState } from "react";
// epubjs no publica tipos propios (ver src/types/epubjs.d.ts); el shim lo deja
// como `any`, así que el tipado de lo que realmente se usa vive aquí.
import ePub from "epubjs";
import { getReadingProgress, setReadingProgress } from "../lib/readingProgress";
import { SPREAD_MIN_WIDTH_PX } from "../lib/readerLayout";
import { highlightOverlayColor } from "../lib/bookAnnotations";
import { useBookAnnotations } from "../lib/useBookAnnotations";
import type { BookAnnotation } from "../lib/types";
import { AnnotationActionBar } from "./AnnotationActionBar";
import { AnnotationDetailModal } from "./AnnotationDetailModal";
import { ErrorState, LoadingState } from "./States";

interface Props {
  bookId: string;
  data: ArrayBuffer;
  showAnnotations: boolean;
}

interface EpubContents {
  window: Window;
}

interface EpubAnnotations {
  highlight(
    cfiRange: string,
    data: Record<string, unknown>,
    cb: (() => void) | undefined,
    className: string,
    styles: Record<string, string>,
  ): void;
  underline(
    cfiRange: string,
    data: Record<string, unknown>,
    cb: (() => void) | undefined,
    className: string,
    styles: Record<string, string>,
  ): void;
  remove(cfiRange: string, type: string): void;
}

interface EpubRendition {
  display(target?: string): Promise<void>;
  prev(): Promise<void>;
  next(): Promise<void>;
  destroy(): void;
  on(event: "relocated", cb: (location: { start?: { cfi?: string } }) => void): void;
  on(event: "rendered", cb: () => void): void;
  on(event: "selected", cb: (cfiRange: string, contents: EpubContents) => void): void;
  themes: { fontSize(size: string): void };
  annotations: EpubAnnotations;
}

interface EpubBook {
  renderTo(el: HTMLElement, opts: Record<string, unknown>): EpubRendition;
  ready: Promise<void>;
  destroy(): void;
}

const SWIPE_THRESHOLD_PX = 50;
const MIN_FONT_PERCENT = 80;
const MAX_FONT_PERCENT = 200;
const FONT_STEP_PERCENT = 10;
const NOTE_UNDERLINE_STYLE = { stroke: "#d97706", "stroke-width": "3" };

// Lector de EPUB para libros comprados: epub.js pagina el propio HTML del
// libro (a diferencia del PDF, que se rasteriza a canvas + capa de texto
// propia — ver BookPdfReader.tsx). El contenido de cada capítulo vive en un
// iframe con su propio documento, así que el `select-none` del contenedor
// exterior no afecta la selección de texto ahí dentro — exactamente lo que
// necesitamos para poder resaltar/anotar.
export function BookEpubReader({ bookId, data, showAnnotations }: Props) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<EpubBook | null>(null);
  const renditionRef = useRef<EpubRendition | null>(null);
  const touchStartX = useRef<number | null>(null);
  const appliedAnnotationsRef = useRef<Set<string>>(new Set());

  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fontPercent, setFontPercent] = useState(100);
  const [pendingSelection, setPendingSelection] = useState<{ cfiRange: string; text: string } | null>(null);
  const [openAnnotation, setOpenAnnotation] = useState<BookAnnotation | null>(null);

  const annotations = useBookAnnotations(bookId);

  useEffect(() => {
    const container = viewerRef.current;
    if (!container) return;
    let cancelled = false;
    const appliedAnnotations = appliedAnnotationsRef.current;

    const book: EpubBook = ePub(data);
    bookRef.current = book;
    // "auto" + minSpreadWidth: epub.js decide solo, según el ancho real del
    // contenedor (y lo reevalúa en cada resize de ventana), si muestra una
    // página o dos lado a lado — mismo punto de corte que BookPdfReader.tsx
    // para que ambos formatos se sientan consistentes.
    const rendition = book.renderTo(container, {
      width: "100%",
      height: "100%",
      flow: "paginated",
      spread: "auto",
      minSpreadWidth: SPREAD_MIN_WIDTH_PX,
    });
    renditionRef.current = rendition;

    rendition.on("rendered", () => {
      if (!cancelled) setIsReady(true);
    });
    rendition.on("relocated", (location) => {
      const cfi = location?.start?.cfi;
      if (cfi) setReadingProgress(bookId, cfi);
    });
    rendition.on("selected", (cfiRange, contents) => {
      const text = contents.window.getSelection()?.toString().trim() ?? "";
      if (text) setPendingSelection({ cfiRange, text });
    });

    const saved = getReadingProgress(bookId) ?? undefined;
    rendition.display(saved).catch(() => {
      if (!cancelled) setLoadError("No se pudo cargar el libro.");
    });

    return () => {
      cancelled = true;
      appliedAnnotations.clear();
      rendition.destroy();
      book.destroy();
    };
  }, [bookId, data]);

  useEffect(() => {
    renditionRef.current?.themes.fontSize(`${fontPercent}%`);
  }, [fontPercent]);

  // Sincroniza las anotaciones guardadas con las marcas visuales de epub.js.
  // Se reconstruye todo desde cero en cada cambio (crear/editar/borrar una
  // anotación, o alternar mostrar/ocultar) en vez de hacer un diff fino: la
  // lista es chica y así un `cb` de clic nunca queda apuntando a datos viejos.
  useEffect(() => {
    const rendition = renditionRef.current;
    if (!rendition) return;
    for (const key of appliedAnnotationsRef.current) {
      const [cfiRange, type] = key.split("|");
      rendition.annotations.remove(cfiRange, type);
    }
    appliedAnnotationsRef.current.clear();

    if (!showAnnotations) return;
    for (const annotation of annotations.data ?? []) {
      if (!annotation.cfi_range) continue;
      const type = annotation.kind === "highlight" ? "highlight" : "underline";
      const styles =
        annotation.kind === "highlight" ? { fill: highlightOverlayColor(annotation.color) } : NOTE_UNDERLINE_STYLE;
      const onClick = () => setOpenAnnotation(annotation);
      if (type === "highlight") {
        rendition.annotations.highlight(annotation.cfi_range, {}, onClick, "", styles);
      } else {
        rendition.annotations.underline(annotation.cfi_range, {}, onClick, "", styles);
      }
      appliedAnnotationsRef.current.add(`${annotation.cfi_range}|${type}`);
    }
  }, [annotations.data, showAnnotations]);

  function goPrev() {
    void renditionRef.current?.prev();
  }
  function goNext() {
    void renditionRef.current?.next();
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }

  function onTouchEnd(e: React.TouchEvent) {
    const startX = touchStartX.current;
    const endX = e.changedTouches[0]?.clientX;
    touchStartX.current = null;
    if (startX == null || endX == null) return;
    const delta = endX - startX;
    if (delta > SWIPE_THRESHOLD_PX) goPrev();
    else if (delta < -SWIPE_THRESHOLD_PX) goNext();
  }

  function clearEpubSelection() {
    const iframeWindow = viewerRef.current?.querySelector("iframe")?.contentWindow;
    iframeWindow?.getSelection()?.removeAllRanges();
  }

  function handleHighlight(color: string) {
    if (!pendingSelection) return;
    annotations.create.mutate(
      { kind: "highlight", color, cfi_range: pendingSelection.cfiRange },
      {
        onSuccess: () => {
          setPendingSelection(null);
          clearEpubSelection();
        },
      },
    );
  }

  function handleSaveNote(body: string) {
    if (!pendingSelection) return;
    annotations.create.mutate(
      { kind: "note", body, cfi_range: pendingSelection.cfiRange },
      {
        onSuccess: () => {
          setPendingSelection(null);
          clearEpubSelection();
        },
      },
    );
  }

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="rounded-xl bg-white p-6 shadow-lg">
          <ErrorState error={new Error(loadError)} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col select-none">
      <div className="relative min-h-0 flex-1 bg-white">
        {/* Superpuesto, nunca oculta el contenedor de abajo con display:none:
            epub.js mide el tamaño real del contenedor al montar el iframe del
            capítulo, y un contenedor oculto se mide como 0x0 — el iframe se
            queda con alto 0 para siempre, incluso después de mostrarlo. */}
        {!isReady && (
          <div className="absolute inset-0 flex items-center justify-center p-4">
            <div className="rounded-xl bg-white p-6 shadow-lg">
              <LoadingState label="Cargando libro…" />
            </div>
          </div>
        )}
        <div
          ref={viewerRef}
          className="h-full w-full"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>

      {pendingSelection && (
        <AnnotationActionBar
          selectedText={pendingSelection.text}
          isSaving={annotations.create.isPending}
          error={annotations.create.error}
          onHighlight={handleHighlight}
          onSaveNote={handleSaveNote}
          onCancel={() => {
            setPendingSelection(null);
            clearEpubSelection();
          }}
        />
      )}

      <div className="flex items-center justify-center gap-3 border-t border-slate-800 bg-slate-950 p-3 text-white">
        <button
          type="button"
          onClick={() => setFontPercent((v) => Math.max(MIN_FONT_PERCENT, v - FONT_STEP_PERCENT))}
          className="focus-ring rounded-md border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800"
          aria-label="Reducir tamaño de letra"
        >
          A−
        </button>
        <button
          type="button"
          onClick={() => setFontPercent((v) => Math.min(MAX_FONT_PERCENT, v + FONT_STEP_PERCENT))}
          className="focus-ring rounded-md border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800"
          aria-label="Aumentar tamaño de letra"
        >
          A+
        </button>
        <span className="mx-2 h-5 w-px bg-slate-700" aria-hidden="true" />
        <button
          type="button"
          onClick={goPrev}
          className="focus-ring rounded-md border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
        >
          ← Anterior
        </button>
        <button
          type="button"
          onClick={goNext}
          className="focus-ring rounded-md border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800"
        >
          Siguiente →
        </button>
      </div>

      {openAnnotation && (
        <AnnotationDetailModal
          annotation={openAnnotation}
          isSaving={annotations.update.isPending}
          isDeleting={annotations.remove.isPending}
          error={annotations.update.error ?? annotations.remove.error}
          onClose={() => setOpenAnnotation(null)}
          onSave={(patch) =>
            annotations.update.mutate(
              { id: openAnnotation.id, ...patch },
              { onSuccess: () => setOpenAnnotation(null) },
            )
          }
          onDelete={() =>
            annotations.remove.mutate(openAnnotation.id, { onSuccess: () => setOpenAnnotation(null) })
          }
        />
      )}
    </div>
  );
}
