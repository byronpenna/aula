import { useEffect, useRef, useState } from "react";
import { getDocument, type PDFDocumentProxy } from "pdfjs-dist";
import "../lib/pdfWorker";
import { getReadingProgress, setReadingProgress } from "../lib/readingProgress";
import { ErrorState, LoadingState } from "./States";

interface Props {
  bookId: string;
  data: ArrayBuffer;
}

const SWIPE_THRESHOLD_PX = 50;

// Lector de PDF para libros comprados (distinto de PdfPreviewModal.tsx, que es
// para adjuntos de curso con notas): solo canvas, sin capa de texto
// seleccionable — disuasivo razonable contra copiar/pegar, no DRM real (ver
// docs/adr/0003-wompi-payments.md para el resto del alcance del módulo). El
// archivo llega ya cargado en memoria (fetch autenticado en BookReaderPage),
// nunca por una URL.
export function BookPdfReader({ bookId, data }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);

  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const doc = await getDocument({ data: data.slice(0) }).promise;
        if (cancelled) return;
        setPdfDoc(doc);
        const saved = Number(getReadingProgress(bookId));
        if (saved >= 1 && saved <= doc.numPages) setPageNumber(saved);
      } catch {
        if (!cancelled) setLoadError("No se pudo cargar el libro.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [bookId, data]);

  useEffect(() => {
    // Depende de `pdfDoc` a propósito: hasta que no hay documento cargado, el
    // componente está en su rama de "cargando" y `wrapRef` todavía no existe
    // en el DOM — con deps [] este efecto corría una sola vez demasiado
    // pronto y nunca medía nada (containerWidth se quedaba en 0 para siempre).
    const el = wrapRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setContainerWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [pdfDoc]);

  const numPages = pdfDoc?.numPages ?? 0;

  useEffect(() => {
    if (!pdfDoc || containerWidth === 0) return;
    let cancelled = false;
    (async () => {
      const page = await pdfDoc.getPage(pageNumber);
      if (cancelled) return;
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context) return;
      const unscaledViewport = page.getViewport({ scale: 1 });
      const scale = Math.min(containerWidth, 900) / unscaledViewport.width;
      const viewport = page.getViewport({ scale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: context, viewport, canvas }).promise;
    })();
    return () => {
      cancelled = true;
    };
  }, [pdfDoc, pageNumber, containerWidth]);

  useEffect(() => {
    if (pdfDoc) setReadingProgress(bookId, String(pageNumber));
  }, [bookId, pdfDoc, pageNumber]);

  function goToPage(next: number) {
    if (next < 1 || next > numPages) return;
    setPageNumber(next);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowRight") goToPage(pageNumber + 1);
      if (e.key === "ArrowLeft") goToPage(pageNumber - 1);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNumber, numPages]);

  function onTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0]?.clientX ?? null;
  }

  function onTouchEnd(e: React.TouchEvent) {
    const startX = touchStartX.current;
    const endX = e.changedTouches[0]?.clientX;
    touchStartX.current = null;
    if (startX == null || endX == null) return;
    const delta = endX - startX;
    if (delta > SWIPE_THRESHOLD_PX) goToPage(pageNumber - 1);
    else if (delta < -SWIPE_THRESHOLD_PX) goToPage(pageNumber + 1);
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

  if (!pdfDoc) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="rounded-xl bg-white p-6 shadow-lg">
          <LoadingState label="Cargando libro…" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col select-none">
      <div
        ref={wrapRef}
        className="flex-1 overflow-auto bg-slate-800"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onContextMenu={(e) => e.preventDefault()}
      >
        <canvas ref={canvasRef} className="mx-auto block shadow-lg" />
      </div>
      <div className="flex items-center justify-center gap-4 border-t border-slate-800 bg-slate-950 p-3 text-white">
        <button
          type="button"
          onClick={() => goToPage(pageNumber - 1)}
          disabled={pageNumber <= 1}
          className="focus-ring rounded-md border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800 disabled:opacity-30"
        >
          ← Anterior
        </button>
        <span className="text-sm text-slate-300">
          Página {pageNumber} de {numPages}
        </span>
        <button
          type="button"
          onClick={() => goToPage(pageNumber + 1)}
          disabled={pageNumber >= numPages}
          className="focus-ring rounded-md border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800 disabled:opacity-30"
        >
          Siguiente →
        </button>
      </div>
    </div>
  );
}
