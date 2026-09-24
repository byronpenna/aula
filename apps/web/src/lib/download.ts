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
