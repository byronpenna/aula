import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "./apiClient";
import type { BookAnnotation, BookAnnotationRect } from "./types";

export interface CreateAnnotationInput {
  kind: "note" | "highlight";
  body?: string;
  color?: string;
  is_shared?: boolean;
  page_number?: number;
  rects?: BookAnnotationRect[];
  cfi_range?: string;
}

export interface UpdateAnnotationInput {
  id: string;
  body?: string;
  color?: string;
  is_shared?: boolean;
}

// CRUD de notas/resaltados de un libro, compartido entre BookPdfReader.tsx y
// BookEpubReader.tsx: ambos formatos usan exactamente la misma forma de dato
// (ver books/schemas.py::BookAnnotationOut), solo difieren en cómo calculan
// `page_number`+`rects` (PDF) o `cfi_range` (EPUB) a partir de una selección.
export function useBookAnnotations(bookId: string) {
  const queryClient = useQueryClient();
  const queryKey = ["books", bookId, "annotations"];

  const query = useQuery<BookAnnotation[]>({
    queryKey,
    queryFn: async () => (await apiClient.get(`/books/${bookId}/annotations`)).data,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const create = useMutation({
    mutationFn: async (payload: CreateAnnotationInput) =>
      (await apiClient.post(`/books/${bookId}/annotations`, payload)).data as BookAnnotation,
    onSuccess: invalidate,
  });

  const update = useMutation({
    mutationFn: async ({ id, ...patch }: UpdateAnnotationInput) =>
      (await apiClient.patch(`/books/${bookId}/annotations/${id}`, patch)).data as BookAnnotation,
    onSuccess: invalidate,
  });

  const remove = useMutation({
    mutationFn: async (id: string) => apiClient.delete(`/books/${bookId}/annotations/${id}`),
    onSuccess: invalidate,
  });

  return { ...query, create, update, remove };
}
