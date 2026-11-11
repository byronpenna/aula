import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/apiClient";
import { formatDateTime } from "../lib/dates";
import { getEmbedUrl, getLinkHostname } from "../lib/linkPreview";
import type { ResourceLink, ResourceLinkComment } from "../lib/types";
import { ErrorState, LoadingState } from "./States";
import { CloseIcon, LinkIcon } from "./icons";

interface Props {
  link: ResourceLink;
  onClose: () => void;
}

// Visor de un enlace agregado como recurso (mismo cuadro modal que
// PdfPreviewModal.tsx): incrusta el video si es de un proveedor reconocido
// (YouTube/Facebook/TikTok, ver lib/linkPreview.ts); si no se puede incrustar
// (página cualquiera — la mayoría bloquea mostrarse en un iframe), ofrece
// abrirlo en una pestaña aparte en vez de dejar un hueco vacío. Los
// comentarios internos son independientes de si se puede incrustar o no —
// cualquiera con acceso al curso puede comentar, a diferencia de las notas de
// un PDF (solo quien administra el curso) — ver
// learning/service.py::create_link_comment.
export function LinkPreviewModal({ link, onClose }: Props) {
  const queryClient = useQueryClient();
  const [commentBody, setCommentBody] = useState("");
  const embedUrl = getEmbedUrl(link.url);

  const commentsQuery = useQuery<ResourceLinkComment[]>({
    queryKey: ["resource-links", link.id, "comments"],
    queryFn: async () => (await apiClient.get(`/resource-links/${link.id}/comments`)).data,
  });

  const createCommentMutation = useMutation({
    mutationFn: async (body: string) =>
      (await apiClient.post(`/resource-links/${link.id}/comments`, { body })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["resource-links", link.id, "comments"] });
      setCommentBody("");
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex h-full max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-brand-100 p-3">
          <p className="min-w-0 truncate font-display font-medium text-brand-900">{link.title}</p>
          <button
            type="button"
            onClick={onClose}
            title="Cerrar"
            aria-label="Cerrar"
            className="focus-ring shrink-0 rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-100"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <div className="flex aspect-video w-full shrink-0 items-center justify-center bg-black md:aspect-auto md:w-2/3">
            {embedUrl ? (
              <iframe
                src={embedUrl}
                title={link.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
              />
            ) : (
              <div className="flex flex-col items-center gap-3 p-6 text-center text-white">
                <LinkIcon className="h-8 w-8 text-slate-400" />
                <p className="text-sm text-slate-300">
                  No se puede mostrar una vista previa de este enlace aquí.
                </p>
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="focus-ring rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
                >
                  Abrir {getLinkHostname(link.url)}
                </a>
              </div>
            )}
          </div>

          <div className="flex min-h-0 w-full flex-1 flex-col overflow-y-auto border-l border-brand-100 p-3 md:w-1/3">
            <h2 className="mb-2 text-sm font-semibold text-brand-900">Comentarios internos</h2>
            <p className="mb-3 text-xs text-slate-500">
              Solo lo ven quienes tienen acceso a este curso.
            </p>

            {commentsQuery.isLoading && <LoadingState label="Cargando comentarios…" />}
            {commentsQuery.error && <ErrorState error={commentsQuery.error} />}
            {commentsQuery.data && commentsQuery.data.length === 0 && (
              <p className="text-sm text-slate-500">Sin comentarios todavía.</p>
            )}
            {commentsQuery.data && commentsQuery.data.length > 0 && (
              <ul className="mb-3 space-y-2">
                {commentsQuery.data.map((comment) => (
                  <li key={comment.id} className="rounded-md border border-brand-100 bg-white p-2">
                    <p className="text-sm text-slate-700">{comment.body}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {comment.author_name} · {formatDateTime(comment.created_at)}
                    </p>
                  </li>
                ))}
              </ul>
            )}

            <form
              className="mt-auto space-y-2 border-t border-brand-50 pt-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (commentBody.trim()) createCommentMutation.mutate(commentBody.trim());
              }}
            >
              <textarea
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                rows={2}
                placeholder="Escribe un comentario…"
                className="focus-ring w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
              />
              {createCommentMutation.isError && <ErrorState error={createCommentMutation.error} />}
              <button
                type="submit"
                disabled={!commentBody.trim() || createCommentMutation.isPending}
                className="focus-ring w-full rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
              >
                Comentar
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
