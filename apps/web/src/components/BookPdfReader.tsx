import { useEffect, useRef, useState } from "react";
import { getDocument, type PDFDocumentProxy, type PDFPageProxy } from "pdfjs-dist";
import "../lib/pdfWorker";
import { getReadingProgress, setReadingProgress } from "../lib/readingProgress";
import { SPREAD_MIN_WIDTH_PX } from "../lib/readerLayout";
import { highlightOverlayColor } from "../lib/bookAnnotations";
import { useBookAnnotations } from "../lib/useBookAnnotations";
import type { BookAnnotation, BookAnnotationRect } from "../lib/types";
import { AnnotationFloatingComposer } from "./AnnotationFloatingComposer";
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
}

const SWIPE_THRESHOLD_PX = 50;
const PAGE_GAP_PX = 16;
const MAX_SINGLE_PAGE_WIDTH_PX = 1000;
const MAX_SPREAD_PAGE_WIDTH_PX = 800;
const MIN_ZOOM = 0.75;
const MAX_ZOOM = 2.5;
const ZOOM_STEP = 0.25;
// Un arrastre más chico que esto (fracción del ancho/alto de la página) se
// trata como un clic simple, no como "dibujó un recuadro" — ver por qué en
// handleMouseDown/handleWindowMouseUp de PdfPage.
const MIN_BOX_SIZE = 0.01;
// Radio (en fracción del ancho/alto de la página) alrededor del punto de clic
// para considerar que tocó la nota existente — ver el hit-test en PdfPage.
const NOTE_HIT_PADDING = 0.012;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

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
// Sección nueva — cambio de enfoque deliberado: versiones anteriores
// intentaban ofrecer selección de texto real (una capa de texto invisible
// posicionada con una fuente aproximada, no la real incrustada en el PDF).
// Esa técnica nunca dio una selección confiable — la fuente aproximada no
// mide igual que la real, así que "dónde empieza/termina" una palabra para
// el navegador no coincidía con lo que se ve, y arrastrar para seleccionar se
// sentía roto. En vez de perseguir esa precisión imposible, resaltar/anotar
// acá se hace dibujando un recuadro a mano sobre la página (como marcar con
// un resaltador físico sobre una hoja escaneada): no depende de ningún texto
// invisible, así que nunca se ve "raro".
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
  const [zoom, setZoom] = useState(1);

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

  // El zoom multiplica la escala de "ajustar al ancho" en vez de reemplazarla:
  // a 100% se comporta igual que antes (ajustado al contenedor), y +/- la
  // agranda/achica desde ahí — más grande siempre hace más cómodo dibujar un
  // recuadro preciso, sin importar el documento.
  const scale =
    containerWidth > 0 && unscaledPageWidth > 0
      ? (Math.min(
          (containerWidth - (pages.length - 1) * PAGE_GAP_PX) / pages.length,
          pages.length === 2 ? MAX_SPREAD_PAGE_WIDTH_PX : MAX_SINGLE_PAGE_WIDTH_PX,
        ) /
          unscaledPageWidth) *
        zoom
      : 0;

  function zoomOut() {
    setZoom((z) => Math.max(MIN_ZOOM, Math.round((z - ZOOM_STEP) * 100) / 100));
  }
  function zoomIn() {
    setZoom((z) => Math.min(MAX_ZOOM, Math.round((z + ZOOM_STEP) * 100) / 100));
  }

  useEffect(() => {
    if (pdfDoc) setReadingProgress(bookId, String(pageNumber));
  }, [bookId, pdfDoc, pageNumber]);

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
    // Con zoom > 100% el swipe horizontal sirve para desplazarse por la
    // página ampliada, no para pasar de página — si no, chocan.
    if (zoom > 1) return;
    const delta = endX - startX;
    if (delta > SWIPE_THRESHOLD_PX) goPrev();
    else if (delta < -SWIPE_THRESHOLD_PX) goNext();
  }

  function handleHighlight(color: string) {
    if (!pendingSelection) return;
    annotations.create.mutate(
      { kind: "highlight", color, page_number: pendingSelection.pageNumber, rects: pendingSelection.rects },
      { onSuccess: () => setPendingSelection(null) },
    );
  }

  function handleSaveNote(body: string) {
    if (!pendingSelection) return;
    annotations.create.mutate(
      { kind: "note", body, page_number: pendingSelection.pageNumber, rects: pendingSelection.rects },
      { onSuccess: () => setPendingSelection(null) },
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
    <div className="flex h-full flex-col select-none">
      <div
        ref={wrapRef}
        className="flex-1 overflow-auto bg-slate-800"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
        onContextMenu={(e) => e.preventDefault()}
      >
        {scale > 0 && (
          // `min-h-full` + `items-center`/`justify-center` centraba la página,
          // pero en un contenedor con scroll eso es un bug clásico de
          // flexbox: cuando el contenido crece más que el contenedor (página
          // alta, o con zoom), el centrado "recorta" el extremo opuesto al
          // que empuja y ese borde deja de alcanzarse haciendo scroll. El
          // padre solo es `flex` (sin alinear nada) y el margen `m-auto` del
          // hijo sí centra quien cabe, y si no cabe cede a 0 sin cortar nada.
          <div className="flex min-h-full">
            <div className="m-auto flex gap-4 p-4">
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
                  pendingSelection={pendingSelection}
                  isSavingPending={annotations.create.isPending}
                  pendingError={annotations.create.error}
                  onHighlightPending={handleHighlight}
                  onSaveNotePending={handleSaveNote}
                  onCancelPending={() => setPendingSelection(null)}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3 border-t border-slate-800 bg-slate-950 p-3 text-white">
        <button
          type="button"
          onClick={zoomOut}
          disabled={zoom <= MIN_ZOOM}
          className="focus-ring rounded-md border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800 disabled:opacity-30"
          aria-label="Alejar"
        >
          A−
        </button>
        <span className="text-xs text-slate-400">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          onClick={zoomIn}
          disabled={zoom >= MAX_ZOOM}
          className="focus-ring rounded-md border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800 disabled:opacity-30"
          aria-label="Acercar"
        >
          A+
        </button>
        <span className="mx-1 h-5 w-px bg-slate-700" aria-hidden="true" />
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

interface DraftBox {
  startX: number;
  startY: number;
  curX: number;
  curY: number;
}

interface PdfPageProps {
  pdfDoc: PDFDocumentProxy;
  pageNumber: number;
  scale: number;
  annotations: BookAnnotation[];
  showAnnotations: boolean;
  onSelection: (selection: PendingSelection) => void;
  onOpenAnnotation: (annotation: BookAnnotation) => void;
  pendingSelection: PendingSelection | null;
  isSavingPending: boolean;
  pendingError: unknown;
  onHighlightPending: (color: string) => void;
  onSaveNotePending: (body: string) => void;
  onCancelPending: () => void;
}

// Una página completa (canvas rasterizado + superposición de resaltados/notas
// existentes + el recuadro que se esté dibujando en este momento, si lo hay).
// Cada una resuelve su propia `PDFPageProxy` para poder mostrarse de forma
// independiente en modo spread (dos instancias de este componente, una por
// página visible).
function PdfPage({
  pdfDoc,
  pageNumber,
  scale,
  annotations,
  showAnnotations,
  onSelection,
  onOpenAnnotation,
  pendingSelection,
  isSavingPending,
  pendingError,
  onHighlightPending,
  onSaveNotePending,
  onCancelPending,
}: PdfPageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [page, setPage] = useState<PDFPageProxy | null>(null);
  const [draft, setDraft] = useState<DraftBox | null>(null);

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
      // de `viewport`, igual que antes, para que la superposición de
      // resaltados (que usa fracciones 0..1 de ese mismo tamaño lógico) no se
      // desalinee.
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

  const highlights = annotations.filter((a) => a.kind === "highlight" && a.page_number === pageNumber);
  const notes = annotations.filter((a) => a.kind === "note" && a.page_number === pageNumber);

  // Resaltar/anotar se hace dibujando un recuadro a mano, no seleccionando
  // texto (ver el porqué en el comentario grande de BookPdfReader.tsx más
  // arriba): mousedown marca la esquina de inicio, mousemove la va
  // agrandando, y mouseup la cierra — o, si el arrastre fue mínimo (un clic
  // simple), se interpreta como "tocó un resaltado/nota existente" en vez de
  // crear uno nuevo.
  function handleMouseDown(event: React.MouseEvent) {
    if (event.button !== 0) return;
    // Mientras haya una selección pendiente (en cualquier página del spread,
    // esperando que se elija color o se escriba una nota), no se empieza un
    // recuadro nuevo encima — primero hay que guardarla o cancelarla.
    if (pendingSelection) return;
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const x = clamp01((event.clientX - rect.left) / rect.width);
    const y = clamp01((event.clientY - rect.top) / rect.height);
    drawingRef.current = true;
    setDraft({ startX: x, startY: y, curX: x, curY: y });
  }

  // En `window`, no en el propio div, por la misma razón que antes: es muy
  // común terminar el arrastre unos píxeles fuera del recuadro exacto de la
  // página (cerca del margen, al scrollear durante el arrastre) y el gesto no
  // debe perderse por eso.
  useEffect(() => {
    function handleWindowMouseMove(event: MouseEvent) {
      if (!drawingRef.current) return;
      const container = containerRef.current;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = clamp01((event.clientX - rect.left) / rect.width);
      const y = clamp01((event.clientY - rect.top) / rect.height);
      setDraft((d) => (d ? { ...d, curX: x, curY: y } : d));
    }

    function handleWindowMouseUp(event: MouseEvent) {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      const container = containerRef.current;
      setDraft((current) => {
        if (!current || !container) return null;
        const x = Math.min(current.startX, current.curX);
        const y = Math.min(current.startY, current.curY);
        const width = Math.abs(current.curX - current.startX);
        const height = Math.abs(current.curY - current.startY);

        if (width < MIN_BOX_SIZE || height < MIN_BOX_SIZE) {
          // Fue un clic, no un arrastre: ¿cayó sobre un resaltado/nota ya
          // existente? Si no, no pasa nada (no se crea un recuadro vacío).
          const rect = container.getBoundingClientRect();
          const fx = clamp01((event.clientX - rect.left) / rect.width);
          const fy = clamp01((event.clientY - rect.top) / rect.height);
          const hitHighlight = highlights.find((a) =>
            (a.rects ?? []).some(
              (r) => fx >= r.x && fx <= r.x + r.width && fy >= r.y && fy <= r.y + r.height,
            ),
          );
          if (hitHighlight) {
            onOpenAnnotation(hitHighlight);
            return null;
          }
          const hitNote = notes.find((a) => {
            const anchor = a.rects?.[0];
            if (!anchor) return false;
            const cx = anchor.x + anchor.width / 2;
            const cy = anchor.y + anchor.height / 2;
            return Math.abs(fx - cx) <= NOTE_HIT_PADDING && Math.abs(fy - cy) <= NOTE_HIT_PADDING;
          });
          if (hitNote) onOpenAnnotation(hitNote);
          return null;
        }

        onSelection({ pageNumber, rects: [{ x, y, width, height }] });
        return null;
      });
    }

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseUp);
    };
  });

  return (
    <div
      ref={containerRef}
      className="relative shrink-0 cursor-crosshair shadow-lg"
      onMouseDown={handleMouseDown}
    >
      <canvas ref={canvasRef} className="block" onDragStart={(e) => e.preventDefault()} />
      {draft && (
        <div
          className="pointer-events-none absolute z-30 rounded-sm border-2 border-dashed border-brand-500 bg-brand-500/20"
          style={{
            left: `${Math.min(draft.startX, draft.curX) * 100}%`,
            top: `${Math.min(draft.startY, draft.curY) * 100}%`,
            width: `${Math.abs(draft.curX - draft.startX) * 100}%`,
            height: `${Math.abs(draft.curY - draft.startY) * 100}%`,
          }}
        />
      )}
      {pendingSelection?.pageNumber === pageNumber &&
        pendingSelection.rects[0] &&
        (() => {
          const rect = pendingSelection.rects[0];
          // El recuadro recién dibujado se queda marcado (no dashed, ya no se
          // está "dibujando") mientras se elige color o se escribe la nota —
          // así se ve qué quedó seleccionado sin tener que recordarlo. El
          // popover se ancla debajo por defecto, o arriba si el recuadro está
          // en la mitad inferior de la página (para no salirse por abajo); el
          // `min(...)` en `left` evita que se salga por la derecha.
          const anchorBelow = rect.y <= 0.6;
          const composerStyle: React.CSSProperties = {
            left: `min(${rect.x * 100}%, calc(100% - 300px))`,
            ...(anchorBelow
              ? { top: `calc(${(rect.y + rect.height) * 100}% + 8px)` }
              : { top: `calc(${rect.y * 100}% - 8px)`, transform: "translateY(-100%)" }),
          };
          return (
            <>
              <div
                className="pointer-events-none absolute z-30 rounded-sm border-2 border-brand-500 bg-brand-500/25"
                style={{
                  left: `${rect.x * 100}%`,
                  top: `${rect.y * 100}%`,
                  width: `${rect.width * 100}%`,
                  height: `${rect.height * 100}%`,
                }}
              />
              <AnnotationFloatingComposer
                isSaving={isSavingPending}
                error={pendingError}
                onHighlight={onHighlightPending}
                onSaveNote={onSaveNotePending}
                onCancel={onCancelPending}
                style={composerStyle}
              />
            </>
          );
        })()}
      {/* pointer-events-none a propósito en ambas superposiciones: abrir un
          resaltado/nota existente se resuelve por hit-test en
          handleWindowMouseUp (arriba), no con un elemento interactivo
          propio — así nunca interceptan el arrastre de un recuadro nuevo. */}
      {showAnnotations &&
        highlights.map((annotation) => {
          const rect = annotation.rects?.[0];
          if (!rect) return null;
          return (
            <div
              key={annotation.id}
              className="pointer-events-none absolute z-10 rounded-sm"
              style={{
                left: `${rect.x * 100}%`,
                top: `${rect.y * 100}%`,
                width: `${rect.width * 100}%`,
                height: `${rect.height * 100}%`,
                backgroundColor: highlightOverlayColor(annotation.color),
                mixBlendMode: "multiply",
              }}
            />
          );
        })}
      {showAnnotations &&
        notes.map((annotation) => {
          const anchor = annotation.rects?.[0];
          if (!anchor) return null;
          return (
            <div
              key={annotation.id}
              className="pointer-events-none absolute z-20 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold text-amber-950 shadow"
              style={{
                left: `${(anchor.x + anchor.width / 2) * 100}%`,
                top: `${(anchor.y + anchor.height / 2) * 100}%`,
              }}
            >
              ✎
            </div>
          );
        })}
    </div>
  );
}
