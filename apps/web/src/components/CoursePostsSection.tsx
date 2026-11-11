import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../lib/apiClient";
import { formatDateTime } from "../lib/dates";
import { getFileBlobUrl } from "../lib/download";
import type { CoursePost, CoursePostComment, CoursePostPoll } from "../lib/types";
import { EmptyState, ErrorState, LoadingState } from "./States";
import { ChatIcon, CloseIcon, ImageIcon, PlusIcon, PollIcon, TrashIcon } from "./icons";

// Publicaciones del curso, tipo "red social" (pestaña nueva): quien administra
// el curso publica (mismo permiso que crear una tarea o fecha importante —
// ASSIGNMENT_MANAGE + estar vinculado a este curso puntual, ver
// learning/service.py::create_course_post); cualquiera en el curso puede
// comentar y votar en la encuesta, igual criterio que comentar un enlace de
// recursos — nunca exclusivo de staff.
export function CoursePostsSection({
  courseId,
  isStaff,
}: {
  courseId: string;
  isStaff: boolean;
}) {
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const queryKey = ["courses", courseId, "posts"];

  const { data, isLoading, error } = useQuery<CoursePost[]>({
    queryKey,
    queryFn: async () => (await apiClient.get(`/courses/${courseId}/posts`)).data,
  });

  const deleteMutation = useMutation({
    mutationFn: async (postId: string) => apiClient.delete(`/posts/${postId}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey }),
  });

  if (isLoading) return <LoadingState label="Cargando publicaciones…" />;
  if (error) return <ErrorState error={error} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-xl font-semibold text-brand-900">
          Publicaciones del curso
        </h1>
        {isStaff && (
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            className="focus-ring rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Nueva publicación
          </button>
        )}
      </div>

      {data && data.length === 0 && (
        <EmptyState
          title="Sin publicaciones todavía"
          description={
            isStaff
              ? "Comparte algo con tu clase: una idea, una pregunta, o una encuesta."
              : "El docente todavía no ha publicado nada en este curso."
          }
        />
      )}

      {data && data.length > 0 && (
        <div className="space-y-4">
          {data.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              courseId={courseId}
              isStaff={isStaff}
              onDelete={() => {
                if (
                  confirm("¿Eliminar esta publicación? Sus comentarios y votos también se borran.")
                ) {
                  deleteMutation.mutate(post.id);
                }
              }}
            />
          ))}
        </div>
      )}
      {deleteMutation.isError && <ErrorState error={deleteMutation.error} />}

      {isModalOpen && (
        <CreatePostModal
          courseId={courseId}
          onClose={() => setIsModalOpen(false)}
          onCreated={() => {
            setIsModalOpen(false);
            queryClient.invalidateQueries({ queryKey });
          }}
        />
      )}
    </div>
  );
}

function PostCard({
  post,
  courseId,
  isStaff,
  onDelete,
}: {
  post: CoursePost;
  courseId: string;
  isStaff: boolean;
  onDelete: () => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const authorInitial = post.author_name.charAt(0).toUpperCase() || "?";

  return (
    <article className="rounded-xl border border-brand-100 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 font-display text-sm font-bold text-brand-700"
          >
            {authorInitial}
          </span>
          <div>
            <p className="font-display font-medium text-brand-900">{post.author_name}</p>
            <p className="text-xs text-slate-500">{formatDateTime(post.created_at)}</p>
          </div>
        </div>
        {isStaff && (
          <button
            type="button"
            onClick={onDelete}
            title="Eliminar"
            aria-label="Eliminar publicación"
            className="focus-ring shrink-0 rounded-md border border-red-200 p-1.5 text-red-700 hover:bg-red-50"
          >
            <TrashIcon />
          </button>
        )}
      </div>

      <p className="mt-3 whitespace-pre-wrap text-sm text-brand-900">{post.body}</p>

      {post.images.length > 0 && (
        <div
          className={`mt-3 grid gap-2 ${post.images.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}
        >
          {post.images.map((image) => (
            <PostImage key={image.id} fileId={image.id} />
          ))}
        </div>
      )}

      {post.poll && <PollWidget poll={post.poll} courseId={courseId} />}

      <div className="mt-3 border-t border-brand-50 pt-2">
        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          className="focus-ring inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-brand-700 hover:bg-brand-50"
        >
          <ChatIcon className="h-4 w-4" />
          {post.comment_count === 0
            ? "Comentar"
            : post.comment_count === 1
              ? "1 comentario"
              : `${post.comment_count} comentarios`}
        </button>
        {showComments && <PostCommentsSection postId={post.id} courseId={courseId} />}
      </div>
    </article>
  );
}

// Toda imagen (igual que las fotos de alumno o los recursos) exige sesión
// autenticada para descargarse — nunca una URL directa, siempre vía blob (ver
// lib/download.ts). No se revoca el blob a propósito: react-query lo sirve
// desde caché entre renders y revocarlo rompería esa reutilización (mismo
// motivo documentado en components/StudentAvatar.tsx).
function PostImage({ fileId }: { fileId: string }) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["files", fileId, "blob-url"],
    queryFn: async () => getFileBlobUrl(fileId),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return <div className="aspect-video animate-pulse rounded-lg bg-slate-100" aria-hidden="true" />;
  }
  if (isError || !data) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-lg bg-slate-50 text-xs text-slate-400">
        No se pudo cargar la imagen
      </div>
    );
  }
  return <img src={data.url} alt="" className="aspect-video w-full rounded-lg object-cover" />;
}

function PollWidget({ poll, courseId }: { poll: CoursePostPoll; courseId: string }) {
  const queryClient = useQueryClient();
  const votedKey = poll.options
    .filter((option) => option.voted_by_me)
    .map((option) => option.id)
    .join(",");
  const [selected, setSelected] = useState<string[]>(votedKey ? votedKey.split(",") : []);

  // Si llega una versión nueva de la encuesta (tras votar o recargar la
  // lista), la selección local se vuelve a alinear con lo que el backend ya
  // tiene registrado para esta persona.
  useEffect(() => {
    setSelected(votedKey ? votedKey.split(",") : []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [votedKey]);

  const hasVoted = votedKey !== "";

  const voteMutation = useMutation({
    mutationFn: async () =>
      (await apiClient.post(`/course-post-polls/${poll.id}/vote`, { option_ids: selected })).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["courses", courseId, "posts"] });
    },
  });

  function toggleOption(optionId: string) {
    if (poll.allow_multiple) {
      setSelected((prev) =>
        prev.includes(optionId) ? prev.filter((id) => id !== optionId) : [...prev, optionId],
      );
    } else {
      setSelected((prev) => (prev[0] === optionId ? [] : [optionId]));
    }
  }

  return (
    <div className="mt-3 rounded-lg border border-brand-100 bg-brand-50/40 p-3">
      <div className="mb-2 flex items-center gap-2">
        <PollIcon className="h-4 w-4 shrink-0 text-brand-600" />
        <p className="text-sm font-medium text-brand-900">{poll.question}</p>
      </div>

      <div className="space-y-1.5">
        {poll.options.map((option) => {
          const percentage =
            poll.total_votes > 0 ? Math.round((option.vote_count / poll.total_votes) * 100) : 0;
          const isSelected = selected.includes(option.id);
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => toggleOption(option.id)}
              className={`focus-ring relative block w-full overflow-hidden rounded-md border px-3 py-2 text-left text-sm ${
                isSelected ? "border-brand-400" : "border-slate-200 hover:border-brand-200"
              }`}
            >
              <span
                className="absolute inset-y-0 left-0 bg-brand-100/70"
                style={{ width: `${percentage}%` }}
                aria-hidden="true"
              />
              <span className="relative flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className={`flex h-4 w-4 shrink-0 items-center justify-center border ${
                      poll.allow_multiple ? "rounded-sm" : "rounded-full"
                    } ${isSelected ? "border-brand-600 bg-brand-600" : "border-slate-300 bg-white"}`}
                  >
                    {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                  </span>
                  <span className="text-brand-900">{option.label}</span>
                </span>
                <span className="shrink-0 text-xs text-slate-500">
                  {option.vote_count} · {percentage}%
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex items-center justify-between gap-2">
        <p className="text-xs text-slate-500">
          {poll.total_votes === 0
            ? "Sin votos todavía"
            : poll.total_votes === 1
              ? "1 voto"
              : `${poll.total_votes} votos`}
          {poll.allow_multiple && " · puede elegir varias opciones"}
        </p>
        <button
          type="button"
          onClick={() => voteMutation.mutate()}
          disabled={selected.length === 0 || voteMutation.isPending}
          className="focus-ring shrink-0 rounded-md bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {hasVoted ? "Actualizar voto" : "Votar"}
        </button>
      </div>
      {voteMutation.isError && <ErrorState error={voteMutation.error} />}
    </div>
  );
}

function PostCommentsSection({ postId, courseId }: { postId: string; courseId: string }) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const queryKey = ["posts", postId, "comments"];

  const { data, isLoading, error } = useQuery<CoursePostComment[]>({
    queryKey,
    queryFn: async () => (await apiClient.get(`/posts/${postId}/comments`)).data,
  });

  const createMutation = useMutation({
    mutationFn: async () => (await apiClient.post(`/posts/${postId}/comments`, { body })).data,
    onSuccess: () => {
      setBody("");
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["courses", courseId, "posts"] });
    },
  });

  return (
    <div className="mt-2 space-y-2">
      {isLoading && <LoadingState label="Cargando comentarios…" />}
      {error && <ErrorState error={error} />}
      {data && data.length > 0 && (
        <ul className="space-y-1.5">
          {data.map((comment) => (
            <li key={comment.id} className="rounded-md bg-slate-50 p-2 text-sm">
              <span className="font-medium text-brand-900">{comment.author_name}</span>{" "}
              <span className="text-slate-700">{comment.body}</span>
              <p className="mt-0.5 text-xs text-slate-400">{formatDateTime(comment.created_at)}</p>
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex items-start gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (body.trim()) createMutation.mutate();
        }}
      >
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={1}
          placeholder="Escribe un comentario…"
          className="focus-ring flex-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={!body.trim() || createMutation.isPending}
          className="focus-ring shrink-0 rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          Enviar
        </button>
      </form>
      {createMutation.isError && <ErrorState error={createMutation.error} />}
    </div>
  );
}

// Cuadro modal para crear la publicación (mismo patrón de overlay que el
// resto de la app): el cuerpo es obligatorio, imágenes y encuesta son
// opcionales. Las imágenes se suben una por una después de crear la
// publicación (necesitan su `post_id`, ver files/service.py::
// upload_course_post_image) — si alguna falla, la publicación ya quedó
// creada; el error se muestra pero no deja nada a medias de forma silenciosa.
function CreatePostModal({
  courseId,
  onClose,
  onCreated,
}: {
  courseId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [body, setBody] = useState("");
  const [imageFiles, setImageFiles] = useState<globalThis.File[]>([]);
  const [hasPoll, setHasPoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState("");
  const [allowMultiple, setAllowMultiple] = useState(false);
  const [options, setOptions] = useState<string[]>(["", ""]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const createMutation = useMutation({
    mutationFn: async () => {
      const payload: {
        body: string;
        poll?: { question: string; allow_multiple: boolean; options: { label: string }[] };
      } = { body };
      if (hasPoll) {
        const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
        payload.poll = {
          question: pollQuestion,
          allow_multiple: allowMultiple,
          options: cleanOptions.map((label) => ({ label })),
        };
      }
      const { data: post } = await apiClient.post(`/courses/${courseId}/posts`, payload);
      for (const file of imageFiles) {
        const formData = new FormData();
        formData.append("upload", file);
        await apiClient.post(`/posts/${post.id}/images`, formData);
      }
      return post;
    },
    onSuccess: onCreated,
  });

  function onFilesSelected(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    setImageFiles((prev) => [...prev, ...files]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeImage(index: number) {
    setImageFiles((prev) => prev.filter((_, i) => i !== index));
  }

  function updateOption(index: number, value: string) {
    setOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
  }
  function addOption() {
    setOptions((prev) => [...prev, ""]);
  }
  function removeOption(index: number) {
    setOptions((prev) => prev.filter((_, i) => i !== index));
  }

  const cleanOptionsCount = options.map((o) => o.trim()).filter(Boolean).length;
  const canSubmit = body.trim() !== "" && (!hasPoll || (pollQuestion.trim() !== "" && cleanOptionsCount >= 2));

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-brand-100 p-3">
          <p className="font-display font-medium text-brand-900">Nueva publicación</p>
          <button
            type="button"
            onClick={onClose}
            title="Cerrar"
            aria-label="Cerrar"
            className="focus-ring rounded-md border border-slate-300 p-1.5 text-slate-600 hover:bg-slate-100"
          >
            <CloseIcon />
          </button>
        </div>

        <form
          className="space-y-3 overflow-y-auto p-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (canSubmit) createMutation.mutate();
          }}
        >
          <textarea
            autoFocus
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            placeholder="Comparte algo con tu clase…"
            className="focus-ring w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
          />

          {imageFiles.length > 0 && (
            <div className="grid grid-cols-3 gap-2">
              {imageFiles.map((file, index) => (
                <div key={`${file.name}-${index}`} className="relative">
                  <img
                    src={URL.createObjectURL(file)}
                    alt=""
                    className="aspect-square w-full rounded-md object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    title="Quitar imagen"
                    aria-label="Quitar imagen"
                    className="focus-ring absolute -top-1.5 -right-1.5 rounded-full bg-white p-0.5 text-slate-600 shadow ring-1 ring-slate-200 hover:text-red-600"
                  >
                    <CloseIcon className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="focus-ring inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-100"
            >
              <ImageIcon className="h-4 w-4" />
              Agregar imágenes
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              multiple
              className="hidden"
              onChange={onFilesSelected}
            />
            <button
              type="button"
              onClick={() => setHasPoll((v) => !v)}
              className={`focus-ring inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs ${
                hasPoll
                  ? "border-brand-400 bg-brand-50 text-brand-700"
                  : "border-slate-300 hover:bg-slate-100"
              }`}
            >
              <PollIcon className="h-4 w-4" />
              {hasPoll ? "Quitar encuesta" : "Agregar encuesta"}
            </button>
          </div>

          {hasPoll && (
            <div className="space-y-2 rounded-lg border border-brand-100 bg-brand-50/40 p-3">
              <input
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                placeholder="Pregunta de la encuesta"
                className="focus-ring w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
              />
              <div className="space-y-1.5">
                {options.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      value={option}
                      onChange={(e) => updateOption(index, e.target.value)}
                      placeholder={`Opción ${index + 1}`}
                      className="focus-ring flex-1 rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
                    />
                    {options.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeOption(index)}
                        title="Quitar opción"
                        aria-label={`Quitar opción ${index + 1}`}
                        className="focus-ring rounded-md border border-slate-300 p-1.5 text-slate-500 hover:bg-slate-100"
                      >
                        <CloseIcon className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addOption}
                className="focus-ring inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                Agregar opción
              </button>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={allowMultiple}
                  onChange={(e) => setAllowMultiple(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300"
                />
                Permitir elegir varias opciones
              </label>
            </div>
          )}

          {createMutation.isError && <ErrorState error={createMutation.error} />}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="focus-ring rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!canSubmit || createMutation.isPending}
              className="focus-ring rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {createMutation.isPending ? "Publicando…" : "Publicar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
