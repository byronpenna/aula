import { useRef, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient, type QueryKey } from "@tanstack/react-query";
import { apiClient } from "../lib/apiClient";
import { downloadFile } from "../lib/download";
import type { FileAttachment } from "../lib/types";
import { ErrorState, LoadingState } from "./States";

interface Props {
  queryKey: QueryKey;
  listUrl: string;
  /** Si se omite, la lista queda de solo lectura (sin control de subida). */
  uploadUrl?: string;
  emptyLabel?: string;
  /** Para cuando subir un archivo puede crear el recurso padre (p. ej. la propia
   * entrega en borrador) y el caller necesita refrescar otra query aparte. */
  onUploaded?: () => void;
  /** false cuando el recurso padre (p. ej. la entrega) todavía no existe: se
   * omite el listado y solo se muestra el control de subida. Default true. */
  enabled?: boolean;
}

// Compartido entre material de tarea, entrega propia y entregas vistas por
// docente/tutor (sección 5/9): mismo componente, cada caller decide si puede
// subir (uploadUrl) pasando o no ese prop.
export function FileAttachments({
  queryKey,
  listUrl,
  uploadUrl,
  emptyLabel = "Sin archivos.",
  onUploaded,
  enabled = true,
}: Props) {
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading, error } = useQuery<FileAttachment[]>({
    queryKey,
    queryFn: async () => (await apiClient.get(listUrl)).data,
    enabled,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: globalThis.File) => {
      const formData = new FormData();
      formData.append("upload", file);
      return (await apiClient.post(uploadUrl as string, formData)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      if (inputRef.current) inputRef.current.value = "";
      onUploaded?.();
    },
  });

  function onFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) uploadMutation.mutate(file);
  }

  return (
    <div>
      {isLoading && <LoadingState label="Cargando archivos…" />}
      {error && <ErrorState error={error} />}
      {data && data.length === 0 && <p className="text-sm text-slate-500">{emptyLabel}</p>}
      {data && data.length > 0 && (
        <ul className="space-y-1">
          {data.map((file) => (
            <li key={file.id} className="flex items-center justify-between gap-2 text-sm">
              <button
                type="button"
                onClick={() => downloadFile(file.id)}
                className="focus-ring truncate rounded text-brand-700 underline hover:text-brand-900"
              >
                {file.filename}
              </button>
              <span className="shrink-0 text-xs text-slate-400">
                {(file.size_bytes / 1024).toFixed(0)} KB
              </span>
            </li>
          ))}
        </ul>
      )}
      {uploadUrl && (
        <div className="mt-2">
          <input
            ref={inputRef}
            type="file"
            onChange={onFileSelected}
            disabled={uploadMutation.isPending}
            className="text-sm"
          />
          {uploadMutation.isPending && <p className="text-xs text-slate-500">Subiendo…</p>}
          {uploadMutation.isError && <ErrorState error={uploadMutation.error} />}
        </div>
      )}
    </div>
  );
}
