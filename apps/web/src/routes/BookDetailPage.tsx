import { useState } from "react";
import { useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/apiClient";
import type { Book, WompiCheckout } from "../lib/types";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { EmptyState, ErrorState, LoadingState } from "../components/States";
import { formatMoney as money } from "../lib/money";
import { downloadBook } from "../lib/download";

// Detalle + compra de un libro (módulo nuevo). "Comprar con Wompi" solo se
// habilita si hay una llave pública configurada (VITE_WOMPI_PUBLIC_KEY); sin
// ella, el botón explica que el pago en línea todavía no está disponible — la
// colecturía manual (Administración > Libros) no depende de esto.
export function BookDetailPage() {
  const { bookId } = useParams<{ bookId: string }>();
  const [checkoutError, setCheckoutError] = useState<unknown>(null);
  const wompiPublicKeyConfigured = Boolean(import.meta.env.VITE_WOMPI_PUBLIC_KEY);

  const { data: book, isLoading, error } = useQuery<Book>({
    queryKey: ["books", bookId],
    queryFn: async () => (await apiClient.get(`/books/${bookId}`)).data,
    enabled: Boolean(bookId),
  });

  const checkoutMutation = useMutation({
    mutationFn: async () =>
      (await apiClient.post<WompiCheckout>(`/books/${bookId}/purchases/wompi`)).data,
    onSuccess: (checkout) => {
      const params = new URLSearchParams({
        "public-key": checkout.public_key,
        currency: checkout.currency,
        "amount-in-cents": String(checkout.amount_in_cents),
        reference: checkout.reference,
        "redirect-url": window.location.href,
      });
      params.set("signature:integrity", checkout.integrity_signature);
      window.location.href = `${checkout.checkout_base_url}?${params.toString()}`;
    },
    onError: setCheckoutError,
  });

  if (isLoading) return <LoadingState label="Cargando libro…" />;
  if (error) return <ErrorState error={error} />;
  if (!book) return <EmptyState title="Libro no encontrado" />;

  return (
    <div className="space-y-4">
      <Breadcrumbs items={[{ label: "Libros", to: "/books" }, { label: book.title }]} />
      <div className="rounded-xl border border-brand-100 bg-white p-5">
        <h1 className="font-display text-2xl font-bold text-brand-900">{book.title}</h1>
        {book.author && <p className="mt-1 text-sm text-brand-600">{book.author}</p>}
        {book.description && <p className="mt-3 text-sm text-slate-700">{book.description}</p>}
        <p className="mt-4 text-lg font-semibold text-brand-900">{money(book.price)}</p>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {book.owned ? (
            <button
              type="button"
              onClick={() => downloadBook(book.id)}
              className="focus-ring rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              Leer / descargar
            </button>
          ) : (
            <button
              type="button"
              disabled={!wompiPublicKeyConfigured || checkoutMutation.isPending}
              onClick={() => checkoutMutation.mutate()}
              title={
                wompiPublicKeyConfigured
                  ? undefined
                  : "El pago en línea todavía no está disponible; pregunta en colecturía."
              }
              className="focus-ring rounded-md bg-accent-500 px-4 py-2 text-sm font-medium text-brand-900 hover:bg-accent-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {checkoutMutation.isPending ? "Redirigiendo a Wompi…" : "Comprar con Wompi"}
            </button>
          )}
          {!book.owned && !wompiPublicKeyConfigured && (
            <p className="text-xs text-slate-500">
              Pago en línea próximamente. Mientras tanto, pregunta en colecturía para comprarlo en
              efectivo.
            </p>
          )}
        </div>
        {Boolean(checkoutError) && <ErrorState error={checkoutError} />}
      </div>
    </div>
  );
}
