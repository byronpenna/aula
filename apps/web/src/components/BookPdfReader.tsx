import { useEffect, useRef, useState } from "react";
import { getDocument, TextLayer, type PDFDocumentProxy, type PDFPageProxy } from "pdfjs-dist";
import "../lib/pdfWorker";
import "./pdfTextLayer.css";
import { getReadingProgress, setReadingProgress } from "../lib/readingProgress";
import { SPREAD_MIN_WIDTH_PX } from "../lib/readerLayout";
import { highlightOverlayColor } from "../lib/bookAnnotations";
import { useBookAnnotations } from "../lib/useBookAnnotations";
import type { BookAnnotation, BookAnnotationRect } from "../lib/types";
import { AnnotationActionBar } from "./AnnotationActionBar";
import { AnnotationDetailModal } from "./AnnotationDetailModal";
import { ErrorState, LoadingState } from "./States";

interface Props {
  bookId: string;
  data: ArrayBuffer;
  showAnnotations: boolean;
}

interface PendingSelection {
  pageNumber: number;
  rects: BookAnnotationRect[];
  text: string;
}

const SWIPE_THRESHOLD_PX = 50;
const PAGE_GAP_PX = 16;
const MAX_SINGLE_PAGE_WIDTH_PX = 900;
const MAX_SPREAD_PAGE_WIDTH_PX = 700;

// Convención de libro físico: la página 1 va sola (portada), luego se muestran
// en pares 2-3, 4-5, ... — así el "spread" de una página cualquiera siempre se
// calcula igual sin importar si se entró a ella como par o impar (restaurar el
// progreso de lectura en la página 5, por ejemplo, siempre arma el par 4-5).
function spreadStart(page: number): number {
  if (page <= 1) return 1;
  return page % 2 === 0 ? page : page - 1;
}

function getSpreadPages(page: number, numPages: number, isSpread: boolean): number[] {
  if (!isSpread) return [page];
  const start = spreadStart(page);
  const pages = [start];
  if (start + 1 <= numPages) pages.push(start + 1);
  return pages;
}

// Lector de PDF para libros comprados (distinto de PdfPreviewModal.tsx, que es
// para adjuntos de curso con notas). El archivo llega ya cargado en memoria
// (fetch autenticado en BookReaderPage), nunca por una URL — ver
// docs/adr/0003-wompi-payments.md para el resto del alcance del módulo.
//
// A diferencia de la primera versión de este lector, sí expone una capa de
// texto seleccionable (pdfjs-dist `TextLayer`, ver pdfTextLayer.css) para
// poder resaltar/anotar texto real — decisión explícita del dueño del
// producto que revierte el "solo canvas" original pensado como disuasivo
// contra copiar/pegar; ese disuasivo ya no aplica a los PDFs de libros.
export function BookPdfReader({ bookId, data, showAnnotations }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const touchStartX = useRef<number | null>(null);

  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [containerWidth, setContainerWidth] = useState(0);
  const [unscaledPageWidth, setUnscaledPageWidth] = useState(0);
  const [pendingSelection, setPendingSelection] = useState<PendingSelection | null>(null);
  const [openAnnotation, setOpenAnnotation] = useState<BookAnnotation | null>(null);

  const annotations = useBookAnnotations(bookId);

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
  // Pantallas angostas (teléfono) muestran una página; a partir de este ancho
  // de contenedor hay espacio cómodo para dos lado a lado, como un libro
  // abierto (mismo punto de corte que BookEpubReader.tsx).
  const isSpread = containerWidth >= SPREAD_MIN_WIDTH_PX;
  const pages = getSpreadPages(pageNumber, numPages, isSpread);

  useEffect(() => {
    if (!pdfDoc) return;
    let cancelled = false;
    (async () => {
      const page = await pdfDoc.getPage(pages[0]);
      if (!cancelled) setUnscaledPageWidth(page.getViewport({ scale: 1 }).width);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfDoc, pages[0]]);

  const scale =
    containerWidth > 0 && unscaledPageWidth > 0
      ? Math.min(
          (containerWidth - (pages.length - 1) * PAGE_GAP_PX) / pages.length,
          pages.length === 2 ? MAX_SPREAD_PAGE_WIDTH_PX : MAX_SINGLE_PAGE_WIDTH_PX,
        ) / unscaledPageWidth
      : 0;

  useEffect(() => {
    if (pdfDoc) setReadingProgress(bookId, String(pageNumber));
  }, [bookId, pdfDoc, pageNumber]);

  function clearNativeSelection() {
    window.getSelection()?.removeAllRanges();
  }

  function goPrev() {
    const target = pages[0] - 1;
    if (target >= 1) setPageNumber(target);
  }

  function goNext() {
    const target = pages[pages.length - 1] + 1;
    if (target <= numPages) setPageNumber(target);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageNumber, numPages, isSpread]);

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

  function handleHighlight(color: string) {
    if (!pendingSelection) return;
    annotations.create.mutate(
      { kind: "highlight", color, page_number: pendingSelection.pageNumber, rects: pendingSelection.rects },
      {
        onSuccess: () => {
          setPendingSelection(null);
          clearNativeSelection();
        },
      },
    );
  }

  function handleSaveNote(body: string) {
    if (!pendingSelection) return;
    annotations.create.mutate(
      { kind: "note", body, page_number: pendingSelection.pageNumber, rects: pendingSelection.rects },
      {
        onSuccess: () => {
          setPendingSelection(null);
          clearNativeSelection();
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

  if (!pdfDoc) {
    return (
      <div className="flex h-full items-center justify-center p-4">
        <div className="rounded-xl bg-white p-6 shadow-lg">
          <LoadingState label="Cargando libro…" />
        </div>
      </div>
    );
  }

  const pageLabel =
    pages.length === 2 ? `Páginas ${pages[0]}–${pages[1]} de ${numPages}` : `Página ${pages[0]} de ${numPages}`;

  return (
    <div className="flex h-full flex-col">
      <div
        ref={wrapRef}
        className="flex-1 overflow-auto bg-slate-800"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onContextMenu={(e) => e.preventDefault()}
      >
        {scale > 0 && (
          <div className="flex min-h-full items-center justify-center gap-4 p-4">
            {pages.map((page) => (
              <PdfPage
                key={page}
                pdfDoc={pdfDoc}
                pageNumber={page}
                scale={scale}
                annotations={annotations.data ?? []}
                showAnnotations={showAnnotations}
                onSelection={setPendingSelection}
                onOpenAnnotation={setOpenAnnotation}
              />
            ))}
          </div>
        )}
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
            clearNativeSelection();
          }}
        />
      )}

      <div className="flex items-center justify-center gap-4 border-t border-slate-800 bg-slate-950 p-3 text-white">
        <button
          type="button"
          onClick={goPrev}
          disabled={pages[0] <= 1}
          className="focus-ring rounded-md border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800 disabled:opacity-30"
        >
          ← Anterior
        </button>
        <span className="text-sm text-slate-300">{pageLabel}</span>
        <button
          type="button"
          onClick={goNext}
          disabled={pages[pages.length - 1] >= numPages}
          className="focus-ring rounded-md border border-slate-700 px-4 py-2 text-sm hover:bg-slate-800 disabled:opacity-30"
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

interface PdfPageProps {
  pdfDoc: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  annotations: BookAnnotation[];
  showAnnotations: boolean;
  onSelection: (selection: PendingSelection) => void;
  onOpenAnnotation: (annotation: BookAnnotation) => void;
}

// Una página completa (canvas rasterizado + capa de texto seleccionable +
// superposición de resaltados/notas existentes). Cada una resuelve su propia
// `PDFPageProxy` para poder mostrarse de forma independiente en modo spread
// (dos instancias de este componente, una por página visible).
function PdfPage({
  pdfDoc,
  pageNumber,
  scale,
  annotations,
  showAnnotations,
  onSelection,
  onOpenAnnotation,
}: PdfPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState<PDFPageProxy | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded = await pdfDoc.getPage(pageNumber);
      if (!cancelled) setPage(loaded);
    })();
    return () => {
      cancelled = true;
    };
  }, [pdfDoc, pageNumber]);

  useEffect(() => {
    if (!page) return;
    let cancelled = false;
    (async () => {
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context) return;
      const viewport = page.getViewport({ scale });
      // Sección nueva: renderizar el bitmap del canvas a la densidad de
      // píxeles real de la pantalla (devicePixelRatio), no a 1 canvas-px por
      // CSS-px — sin esto el texto se ve notoriamente borroso en cualquier
      // pantalla Retina/HiDPI (la mayoría de laptops y celulares actuales).
      // El tamaño CSS (`style.width/height`) se queda en el tamaño "lógico"
      // de `viewport`, igual que antes, para no desalinear la capa de texto
      // ni la superposición de resaltados (ambas usan fracciones 0..1 de ese
      // mismo tamaño lógico).
      const outputScale = window.devicePixelRatio || 1;
      canvas.width = Math.floor(viewport.width * outputScale);
      canvas.height = Math.floor(viewport.height * outputScale);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : undefined;
      const task = page.render({ canvasContext: context, viewport, canvas, transform });
      await task.promise.catch(() => {
        // Una re-renderización (p. ej. cambio de escala) cancela la anterior
        // con una excepción esperada — no es un error real que mostrar.
      });
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [page, scale]);

  useEffect(() => {
    if (!page) return;
    const container = textLayerRef.current;
    if (!container) return;
    container.replaceChildren();
    let cancelled = false;
    let layer: TextLayer | null = null;
    (async () => {
      const viewport = page.getViewport({ scale });
      const textContent = await page.getTextContent();
      if (cancelled) return;
      layer = new TextLayer({ textContentSource: textContent, container, viewport });
      await layer.render();
    })();
    return () => {
      cancelled = true;
      layer?.cancel();
    };
  }, [page, scale]);

  function handleMouseUp() {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    const text = selection.toString().trim();
    if (!text) return;
    const range = selection.getRangeAt(0);
    const container = containerRef.current;
    if (!container || !container.contains(range.commonAncestorContainer)) return;
    const containerRect = container.getBoundingClientRect();
    const rects: BookAnnotationRect[] = Array.from(range.getClientRects())
      .filter((r) => r.width > 0 && r.height > 0)
      .map((r) => ({
        x: (r.left - containerRect.left) / containerRect.width,
        y: (r.top - containerRect.top) / containerRect.height,
        width: r.width / containerRect.width,
        height: r.height / containerRect.height,
      }));
    if (rects.length === 0) return;
    onSelection({ pageNumber, rects, text });
  }

  const highlights = annotations.filter((a) => a.kind === "highlight" && a.page_number === pageNumber);
  const notes = annotations.filter((a) => a.kind === "note" && a.page_number === pageNumber);

  return (
    <div ref={containerRef} className="relative shrink-0 shadow-lg" onMouseUp={handleMouseUp}>
      <canvas ref={canvasRef} className="block" />
      <div ref={textLayerRef} className="textLayer" />
      {showAnnotations &&
        highlights.flatMap((annotation) =>
          (annotation.rects ?? []).map((rect, index) => (
            <button
              key={`${annotation.id}-${index}`}
              type="button"
              onClick={() => onOpenAnnotation(annotation)}
              className="absolute z-10 cursor-pointer rounded-sm border-0 p-0"
              style={{
                left: `${rect.x * 100}%`,
                top: `${rect.y * 100}%`,
                width: `${rect.width * 100}%`,
                height: `${rect.height * 100}%`,
                backgroundColor: highlightOverlayColor(annotation.color),
                mixBlendMode: "multiply",
              }}
              aria-label="Ver resaltado"
            />
          )),
        )}
      {showAnnotations &&
        notes.map((annotation) => {
          const anchor = annotation.rects?.[0];
          if (!anchor) return null;
          return (
            <button
              key={annotation.id}
              type="button"
              onClick={() => onOpenAnnotation(annotation)}
              className="focus-ring absolute z-20 flex items-center justify-center rounded-full border-0 bg-amber-400 text-[9px] font-bold text-amber-950 shadow"
              style={{
                left: `${(anchor.x + anchor.width) * 100}%`,
                top: `${anchor.y * 100}%`,
                // Alto igual al de la línea anotada (nunca un tamaño fijo): en
                // documentos con interlineado ajustado, un marcador de tamaño
                // fijo se mete en la línea de arriba — ver verificación manual.
                height: `${anchor.height * 100}%`,
                width: `${anchor.height * 100}%`,
                minHeight: "14px",
                minWidth: "14px",
                maxHeight: "20px",
                maxWidth: "20px",
              }}
              aria-label="Ver nota"
            >
              ✎
            </button>
          );
        })}
    </div>
  );
}
