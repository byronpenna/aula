import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { apiClient } from "../lib/apiClient";
import type { Book } from "../lib/types";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { formatMoney as money } from "../lib/money";

// Catálogo de libros digitales (módulo nuevo, independiente de cursos): visible
// para cualquiera con el permiso books:read (el backend ya filtra eso, ver
// GET /books), igual que CoursesPage.tsx. Solo el contenido queda gateado por
// compra — el catálogo (título/autor/precio) es de lectura abierta.
export function BooksPage() {
  const { data, isLoading, error } = useQuery<Book[]>({
    queryKey: ["books"],
    queryFn: async () => (await apiClient.get("/books")).data,
  });

  if (isLoading) return <LoadingState label="Cargando libros…" />;
  if (error) return <ErrorState error={error} />;
  if (!data || data.length === 0) {
    return (
      <EmptyState
        title="No hay libros en el catálogo todavía"
        description="Si administras el colegio, agrega el primer libro desde Administración > Libros."
      />
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold text-brand-900">Libros</h1>
          <p className="mt-1 text-sm text-brand-600">
            {data.length === 1 ? "1 libro disponible" : `${data.length} libros disponibles`}
          </p>
        </div>
        <Link to="/mis-libros" className="focus-ring rounded text-sm text-brand-700 underline">
          Mi biblioteca
        </Link>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data.map((book) => (
          <li key={book.id}>
            <Link
              to={`/books/${book.id}`}
              className="focus-ring group block h-full rounded-2xl border border-brand-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md"
            >
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-100 font-display text-lg font-bold text-brand-700 transition-colors group-hover:bg-accent-400 group-hover:text-brand-900"
                >
                  {book.title.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display font-semibold text-brand-900">{book.title}</p>
                  {book.author && <p className="truncate text-sm text-brand-600">{book.author}</p>}
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3 border-t border-brand-50 pt-3 text-sm text-brand-600">
                <span className="font-medium text-brand-900">{money(book.price)}</span>
                <span aria-hidden="true" className="h-3 w-px bg-brand-200" />
                <span>{book.owned ? "Ya lo compraste" : "Disponible para comprar"}</span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
