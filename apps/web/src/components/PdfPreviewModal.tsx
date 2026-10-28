import { useEffect, useRef, useState, type MouseEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getDocument, type PDFDocumentProxy } from "pdfjs-dist";
import "../lib/pdfWorker";
import { apiClient } from "../lib/apiClient";
import { downloadFile, getFileBlobUrl } from "../lib/download";
import type { FileNote } from "../lib/types";
import { ErrorState, LoadingState } from "./States";

interface Props {
  fileId: string;
  filename: string;
  isStaff: boolean;
  onClose: () => void;
}

// Visor de PDF con notas (sección nueva, no del documento base): todo el que ve
// el curso puede previsualizar y descargar; agregar notas (de página completa o
// ancladas a un punto exacto) es solo de quien administra el curso — reforzado
// en el backend (files_service.create_file_note), este componente solo oculta el
// control (ver aula_virtual_linares_agente_v2/README.md regla 4: ocultar un botón
// nunca sustituye la autorización real).
export function PdfPreviewModal({ fileId, filename, isStaff, onClose }: Props) {
  const queryClient = useQueryClient();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasWrapRef = useRef<HTMLDivElement>(null);

  const [pdfDoc, setPdfDoc] = useState<PDFDocumentProxy | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [isPinning, setIsPinning] = useState(false);
  const [pendingPin, setPendingPin] = useState<{ x: number; y: number } | null>(null);
  const [pinBody, setPinBody] = useState("");
  const [showPageNoteForm, setShowPageNoteForm] = useState(false);
  const [pageNoteBody, setPageNoteBody] = useState("");
  const [highlightedNoteId, setHighlightedNoteId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let objectUrl: string | null = null;
    async function load() {
      setLoadError(null);
      setPdfDoc(null);
      try {
        const { url } = await getFileBlobUrl(fileId);
        objectUrl = url;
        if (cancelled) return;
        const doc = await getDocument({ url }).promise;
        if (cancelled) return;
        setPdfDoc(doc);
      } catch {
        if (!cancelled) setLoadError("No se pudo cargar la vista previa del PDF.");
      }
    }
    load();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId]);

  const numPages = pdfDoc?.numPages ?? 0;

  useEffect(() => {
    if (!pdfDoc) return;
    let cancelled = false;
    (async () => {
      const page = await pdfDoc.getPage(pageNumber);
      if (cancelled) return;
      const canvas = canvasRef.current;
      const context = canvas?.getContext("2d");
      if (!canvas || !context) return;
      const containerWidth = canvasWrapRef.current?.clientWidth ?? 800;
      const unscaledViewport = page.getViewport({ scale: 1 });
      const scale = containerWidth / unscaledViewport.width;
      const viewport = page.getViewport({ scale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: context, viewport, canvas }).promise;
    })();
    return () => {
      cancelled = true;
    };
  }, [pdfDoc, pageNumber]);

  const notesQuery = useQuery<FileNote[]>({
    queryKey: ["files", fileId, "notes"],
    queryFn: async () => (await apiClient.get(`/files/${fileId}/notes`)).data,
  });

  const createNoteMutation = useMutation({
    mutationFn: async (payload: { page_number: number; body: string; x?: number; y?: number }) =>
      (await apiClient.post<FileNote>(`/files/${fileId}/notes`, payload)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["files", fileId, "notes"] });
      setPageNoteBody("");
      setShowPageNoteForm(false);
      setPinBody("");
      setPendingPin(null);
      setIsPinning(false);
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => apiClient.delete(`/file-notes/${noteId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["files", fileId, "notes"] }),
  });

  const allNotes = notesQuery.data ?? [];
  const notesOnPage = allNotes.filter((note) => note.page_number === pageNumber);
  const pins = notesOnPage.filter((note) => note.x !== null && note.y !== null);
  const pageOnlyNotes = notesOnPage.filter((note) => note.x === null);

  function goToPage(next: number) {
    if (next < 1 || next > numPages) return;
    setPageNumber(next);
    setIsPinning(false);
    setPendingPin(null);
    setShowPageNoteForm(false);
  }

  function handleCanvasClick(event: MouseEvent<HTMLDivElement>) {
    if (!isPinning) return;
    const rect = event.currentTarget.getBoundingClientRect();
    setPendingPin({
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    });
  }

  function submitPinNote() {
    if (!pendingPin || !pinBody.trim()) return;
    createNoteMutation.mutate({
      page_number: pageNumber,
      body: pinBody.trim(),
      x: pendingPin.x,
      y: pendingPin.y,
    });
  }

  function submitPageNote() {
    if (!pageNoteBody.trim()) return;
    createNoteMutation.mutate({ page_number: pageNumber, body: pageNoteBody.trim() });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="flex h-full max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-brand-100 p-3">
          <p className="min-w-0 truncate font-display font-medium text-brand-900">{filename}</p>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => downloadFile(fileId)}
              className="focus-ring rounded-md border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-100"
            >
              Descargar
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar vista previa"
              className="focus-ring rounded-md border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-100"
            >
              Cerrar
            </button>
          </div>
        </div>

        {loadError && (
          <div className="p-4">
            <ErrorState error={new Error(loadError)} />
          </div>
        )}

        {!loadError && !pdfDoc && <LoadingState label="Cargando el PDF…" />}

        {!loadError && pdfDoc && (
          <div className="flex min-h-0 flex-1">
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex items-center justify-center gap-3 border-b border-brand-50 p-2 text-sm">
                <button
                  type="button"
                  onClick={() => goToPage(pageNumber - 1)}
                  disabled={pageNumber <= 1}
                  className="focus-ring rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100 disabled:opacity-40"
                >
                  Anterior
                </button>
                <span className="text-brand-700">
                  Página {pageNumber} de {numPages}
                </span>
                <button
                  type="button"
                  onClick={() => goToPage(pageNumber + 1)}
                  disabled={pageNumber >= numPages}
                  className="focus-ring rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100 disabled:opacity-40"
                >
                  Siguiente
                </button>
              </div>

              {isStaff && isPinning && (
                <p className="bg-accent-400/30 px-3 py-1.5 text-center text-xs font-medium text-brand-900">
                  Haz clic en el PDF para ubicar la nota.
                </p>
              )}

              <div ref={canvasWrapRef} className="flex-1 overflow-auto bg-slate-100 p-3">
                <div
                  className="relative mx-auto w-fit"
                  onClick={handleCanvasClick}
                  style={{ cursor: isPinning ? "crosshair" : "default" }}
                >
                  <canvas ref={canvasRef} className="block shadow-sm" />
                  {pins.map((note, index) => (
                    <button
                      key={note.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setHighlightedNoteId(note.id);
                      }}
                      title={note.body}
                      className="absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-accent-400 text-xs font-bold text-brand-900 shadow ring-2 ring-white hover:bg-accent-500"
                      style={{ left: `${(note.x ?? 0) * 100}%`, top: `${(note.y ?? 0) * 100}%` }}
                    >
                      {index + 1}
                    </button>
                  ))}
                  {pendingPin && (
                    <span
                      aria-hidden="true"
                      className="absolute flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white ring-2 ring-dashed ring-brand-600"
                      style={{ left: `${pendingPin.x * 100}%`, top: `${pendingPin.y * 100}%` }}
                    />
                  )}
                </div>
              </div>
            </div>

            <div className="flex w-72 shrink-0 flex-col overflow-y-auto border-l border-brand-100 p-3">
              <h2 className="mb-2 text-sm font-semibold text-brand-900">Notas de esta página</h2>

              {notesQuery.isLoading && <LoadingState label="Cargando notas…" />}
              {notesQuery.error && <ErrorState error={notesQuery.error} />}

              {pendingPin && (
                <div className="mb-3 rounded-md border border-brand-200 bg-brand-50 p-2">
                  <p className="mb-1 text-xs font-medium text-brand-800">Nueva nota en este punto</p>
                  <textarea
                    autoFocus
                    value={pinBody}
                    onChange={(e) => setPinBody(e.target.value)}
                    rows={3}
                    className="focus-ring w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                  />
                  {createNoteMutation.isError && <ErrorState error={createNoteMutation.error} />}
                  <div className="mt-1.5 flex gap-2">
                    <button
                      type="button"
                      onClick={submitPinNote}
                      disabled={!pinBody.trim() || createNoteMutation.isPending}
                      className="focus-ring rounded-md bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                    >
                      Guardar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPendingPin(null);
                        setPinBody("");
                      }}
                      className="focus-ring rounded-md border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-100"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {pins.length === 0 && pageOnlyNotes.length === 0 && !pendingPin && (
                <p className="text-sm text-slate-500">Sin notas en esta página.</p>
              )}

              {pins.length > 0 && (
                <ul className="mb-3 space-y-2">
                  {pins.map((note, index) => (
                    <li
                      key={note.id}
                      className={`rounded-md border p-2 ${
                        highlightedNoteId === note.id
                          ? "border-brand-400 bg-brand-50"
                          : "border-brand-100 bg-white"
                      }`}
                    >
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-400 text-[10px] font-bold text-brand-900">
                          {index + 1}
                        </span>
                        {isStaff && (
                          <button
                            type="button"
                            onClick={() => deleteNoteMutation.mutate(note.id)}
                            className="focus-ring rounded text-xs text-red-700 hover:underline"
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                      <p className="text-sm text-slate-700">{note.body}</p>
                      <p className="mt-1 text-xs text-slate-400">{note.author_name}</p>
                    </li>
                  ))}
                </ul>
              )}

              {pageOnlyNotes.length > 0 && (
                <ul className="mb-3 space-y-2">
                  {pageOnlyNotes.map((note) => (
                    <li key={note.id} className="rounded-md border border-brand-100 bg-white p-2">
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <p className="text-sm text-slate-700">{note.body}</p>
                        {isStaff && (
                          <button
                            type="button"
                            onClick={() => deleteNoteMutation.mutate(note.id)}
                            className="focus-ring shrink-0 rounded text-xs text-red-700 hover:underline"
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">{note.author_name}</p>
                    </li>
                  ))}
                </ul>
              )}

              {isStaff && (
                <div className="mt-auto space-y-2 border-t border-brand-50 pt-3">
                  {showPageNoteForm ? (
                    <div>
                      <textarea
                        autoFocus
                        value={pageNoteBody}
                        onChange={(e) => setPageNoteBody(e.target.value)}
                        rows={3}
                        placeholder="Detalle adicional para esta página…"
                        className="focus-ring w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                      />
                      {createNoteMutation.isError && <ErrorState error={createNoteMutation.error} />}
                      <div className="mt-1.5 flex gap-2">
                        <button
                          type="button"
                          onClick={submitPageNote}
                          disabled={!pageNoteBody.trim() || createNoteMutation.isPending}
                          className="focus-ring rounded-md bg-brand-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
                        >
                          Guardar
                        </button>
                        <button
                          type="button"
                          onClick={() => setShowPageNoteForm(false)}
                          className="focus-ring rounded-md border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-100"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowPageNoteForm(true)}
                      className="focus-ring w-full rounded-md border border-brand-200 px-2.5 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50"
                    >
                      Agregar nota de página
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      setIsPinning((v) => !v);
                      setPendingPin(null);
                    }}
                    className={`w-full rounded-md border px-2.5 py-1.5 text-xs font-medium ${
                      isPinning
                        ? "border-brand-600 bg-brand-600 text-white"
                        : "focus-ring border-brand-200 text-brand-700 hover:bg-brand-50"
                    }`}
                  >
                    {isPinning ? "Cancelar nota en un punto" : "Agregar nota en un punto"}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
