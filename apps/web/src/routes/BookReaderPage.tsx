import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, Navigate, useParams } from "react-router-dom";
import { apiClient } from "../lib/apiClient";
import { useAuth } from "../context/AuthContext";
import type { Book } from "../lib/types";
import { getShowAnnotations, setShowAnnotations } from "../lib/annotationPrefs";
import { ErrorState, LoadingState } from "../components/States";
import { BookPdfReader } from "../components/BookPdfReader";
import { BookEpubReader } from "../components/BookEpubReader";

// Lector inmersivo de pantalla completa (módulo nuevo, "libros"): a propósito
// vive FUERA de <AppShell> (ver App.tsx) para no competir por espacio con el
// header/nav del sitio en móvil, igual que una app de lectura dedicada. Hace
// su propio chequeo de sesión (mismo criterio que AppShell.tsx) porque no
// hereda el suyo. El contenido nunca llega por una URL: se trae una sola vez
// vía fetch autenticado (`GET /books/:id/content`, responseType arraybuffer) y
// se renderiza en memoria — ver books/service.py::get_book_content.
export function BookReaderPage() {
  const { bookId } = useParams<{ bookId: string }>();
  const { me, isInitializing } = useAuth();
  const [showAnnotations, setShowAnnotationsState] = useState(getShowAnnotations);

  function toggleAnnotations() {
    setShowAnnotationsState((prev) => {
      const next = !prev;
      setShowAnnotations(next);
      return next;
    });
  }

  const bookQuery = useQuery<Book>({
    queryKey: ["books", bookId],
    queryFn: async () => (await apiClient.get(`/books/${bookId}`)).data,
    enabled: Boolean(bookId) && Boolean(me),
  });

  const contentQuery = useQuery<ArrayBuffer>({
    queryKey: ["books", bookId, "content"],
    queryFn: async () =>
      (await apiClient.get(`/books/${bookId}/content`, { responseType: "arraybuffer" })).data,
    enabled: Boolean(bookId) && Boolean(me),
  });

  if (isInitializing) {
    return (
      <div className="flex h-dvh items-center justify-center bg-slate-900 text-sm text-slate-300">
        Cargando…
      </div>
    );
  }
  if (!me) {
    return <Navigate to="/login" replace />;
  }

  const isLoading = bookQuery.isLoading || contentQuery.isLoading;
  const error = bookQuery.error ?? contentQuery.error;
  const book = bookQuery.data;
  const content = contentQuery.data;

  return (
    <div className="flex h-dvh flex-col bg-slate-900">
      <header className="flex shrink-0 items-center gap-3 border-b border-slate-800 bg-slate-950 px-3 py-2 text-white">
        <Link
          to={bookId ? `/books/${bookId}` : "/books"}
          className="focus-ring shrink-0 rounded px-2 py-1 text-sm hover:bg-slate-800"
        >
          ← Volver
        </Link>
        <p className="min-w-0 flex-1 truncate text-center text-sm font-medium sm:text-left">
          {book?.title ?? "Leyendo…"}
        </p>
        <button
          type="button"
          onClick={toggleAnnotations}
          className="focus-ring shrink-0 rounded px-2 py-1 text-xs hover:bg-slate-800 sm:text-sm"
        >
          {showAnnotations ? "Ocultar anotaciones" : "Mostrar anotaciones"}
        </button>
      </header>

      <div className="min-h-0 flex-1">
        {isLoading && (
          <div className="flex h-full items-center justify-center p-4">
            <div className="rounded-xl bg-white p-6 shadow-lg">
              <LoadingState label="Cargando libro…" />
            </div>
          </div>
        )}
        {!isLoading && Boolean(error) && (
          <div className="flex h-full items-center justify-center p-4">
            <div className="w-full max-w-md rounded-xl bg-white p-2 shadow-lg">
              <ErrorState error={error} />
            </div>
          </div>
        )}
        {!isLoading && !error && book && content && bookId && (
          book.file_content_type === "application/epub+zip" ? (
            <BookEpubReader bookId={bookId} data={content} showAnnotations={showAnnotations} />
          ) : (
            <BookPdfReader bookId={bookId} data={content} showAnnotations={showAnnotations} />
          )
        )}
      </div>
    </div>
  );
}
