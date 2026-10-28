import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiClient } from "../lib/apiClient";
import type { Book } from "../lib/types";
import { EmptyState, ErrorState, LoadingState } from "../components/States";

// "Mi biblioteca" (módulo nuevo): libros con una compra "paid" del usuario
// actual (o de un alumno que tiene vinculado, si es tutor) — ver GET /me/books.
export function MyBooksPage() {
  const { data, isLoading, error } = useQuery<Book[]>({
    queryKey: ["me", "books"],
    queryFn: async () => (await apiClient.get("/me/books")).data,
  });

  if (isLoading) return <LoadingState label="Cargando tu biblioteca…" />;
  if (error) return <ErrorState error={error} />;
  if (!data || data.length === 0) {
    return (
      <EmptyState
        title="Todavía no tienes libros"
        description="Explora el catálogo y compra el primero."
      />
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-bold text-brand-900">Mi biblioteca</h1>
        <Link to="/books" className="focus-ring rounded text-sm text-brand-700 underline">
          Ver catálogo
        </Link>
      </div>
      <ul className="divide-y divide-brand-50 rounded-xl border border-brand-100 bg-white">
        {data.map((book) => (
          <li key={book.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div>
              <Link to={`/books/${book.id}`} className="focus-ring font-medium text-brand-900 hover:underline">
                {book.title}
              </Link>
              {book.author && <p className="text-sm text-slate-500">{book.author}</p>}
            </div>
            <Link
              to={`/books/${book.id}/read`}
              className="focus-ring rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700"
            >
              Leer ahora
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
