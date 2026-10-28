// Configura el worker de pdfjs-dist una sola vez (efecto de módulo, idempotente
// si se importa más de una vez): lo comparten PdfPreviewModal.tsx (adjuntos de
// curso) y BookPdfReader.tsx (lector de libros), para no duplicar el setup.
import { GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
