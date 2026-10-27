import { apiClient } from "./apiClient";

interface FileDownload {
  url: string | null;
  content_base64: string | null;
  filename: string;
  content_type: string;
}

// En cloud el backend firma una URL directa a S3 (`url`); en local no hay S3 real,
// así que devuelve el contenido en base64 y se arma el blob aquí (ver
// app/modules/files/storage.py). Un único helper cubre ambos casos.
export async function downloadFile(fileId: string): Promise<void> {
  const { data } = await apiClient.get<FileDownload>(`/files/${fileId}/download`);
  if (data.url) {
    window.open(data.url, "_blank", "noopener,noreferrer");
    return;
  }
  if (!data.content_base64) return;
  const bytes = Uint8Array.from(atob(data.content_base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: data.content_type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = data.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// Mismo contrato que downloadFile, pero contra /books/:id/download (gateado por
// compra, no por acceso al curso — ver books/service.py::get_book_download).
export async function downloadBook(bookId: string): Promise<void> {
  const { data } = await apiClient.get<FileDownload>(`/books/${bookId}/download`);
  if (data.url) {
    window.open(data.url, "_blank", "noopener,noreferrer");
    return;
  }
  if (!data.content_base64) return;
  const bytes = Uint8Array.from(atob(data.content_base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: data.content_type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = data.filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// Para la vista previa (PdfPreviewModal.tsx): mismo endpoint/payload que
// downloadFile, pero devuelve un blob: URL en vez de disparar la descarga, para
// pasárselo a pdf.js. El caller es responsable de revocar la URL al terminar.
export async function getFileBlobUrl(
  fileId: string,
): Promise<{ url: string; filename: string; contentType: string }> {
  const { data } = await apiClient.get<FileDownload>(`/files/${fileId}/download`);
  if (data.url) {
    const response = await fetch(data.url);
    const blob = await response.blob();
    return { url: URL.createObjectURL(blob), filename: data.filename, contentType: data.content_type };
  }
  if (!data.content_base64) {
    throw new Error("El archivo no tiene contenido disponible.");
  }
  const bytes = Uint8Array.from(atob(data.content_base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: data.content_type });
  return { url: URL.createObjectURL(blob), filename: data.filename, contentType: data.content_type };
}
