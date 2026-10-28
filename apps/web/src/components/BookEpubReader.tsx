import { useEffect, useRef, useState } from "react";
// epubjs no publica tipos propios (ver src/types/epubjs.d.ts); el shim lo deja
// como `any`, así que el tipado de lo que realmente se usa vive aquí.
import ePub from "epubjs";
import { getReadingProgress, setReadingProgress } from "../lib/readingProgress";
import { ErrorState, LoadingState } from "./States";

interface Props {
  bookId: string;
  data: ArrayBuffer;
}

interface EpubRendition {
  display(target?: string): Promise<void>;
  prev(): Promise<void>;
  next(): Promise<void>;
  destroy(): void;
  on(event: "relocated", cb: (location: { start?: { cfi?: string } }) => void): void;
  on(event: "rendered", cb: () => void): void;
  themes: { fontSize(size: string): void };
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

// Lector de EPUB para libros comprados: epub.js pagina el propio HTML del
// libro (a diferencia del PDF, que se rasteriza a canvas). `user-select: none`
// es el único disuasivo posible aquí contra copiar texto — no es DRM real
// (mismo alcance documentado en BookPdfReader.tsx).
export function BookEpubReader({ bookId, data }: Props) {
  const viewerRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<EpubBook | null>(null);
  const renditionRef = useRef<EpubRendition | null>(null);
  const touchStartX = useRef<number | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fontPercent, setFontPercent] = useState(100);

  useEffect(() => {
    const container = viewerRef.current;
    if (!container) return;
    let cancelled = false;

    const book: EpubBook = ePub(data);
    bookRef.current = book;
    const rendition = book.renderTo(container, {
      width: "100%",
      height: "100%",
      flow: "paginated",
      spread: "none",
    });
    renditionRef.current = rendition;

    rendition.on("rendered", () => {
      if (!cancelled) setIsReady(true);
    });
    rendition.on("relocated", (location) => {
      const cfi = location?.start?.cfi;
      if (cfi) setReadingProgress(bookId, cfi);
    });

    const saved = getReadingProgress(bookId) ?? undefined;
    rendition.display(saved).catch(() => {
      if (!cancelled) setLoadError("No se pudo cargar el libro.");
    });

    return () => {
      cancelled = true;
      rendition.destroy();
      book.destroy();
    };
  }, [bookId, data]);

  useEffect(() => {
    renditionRef.current?.themes.fontSize(`${fontPercent}%`);
  }, [fontPercent]);

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
    </div>
  );
}
