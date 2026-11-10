import { useRef, useState, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiClient } from "../lib/apiClient";
import type { Book, BookFileVersion, BookPurchase, Permissions, StudentProfile } from "../lib/types";
import { Breadcrumbs } from "../components/Breadcrumbs";
import { EmptyState, ErrorState, ForbiddenState, LoadingState } from "../components/States";
import { StatusBadge } from "../components/StatusBadge";
import { formatMoney as money } from "../lib/money";
import { formatDateTime } from "../lib/dates";
import { ChevronDownIcon } from "../components/icons";
import { PURCHASE_METHOD_LABEL, PURCHASE_STATUS_CLASS, PURCHASE_STATUS_LABEL } from "../lib/books";

const inputClass = "focus-ring w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm";
const smallBtn =
  "focus-ring rounded-md border border-slate-300 px-2.5 py-1 text-xs hover:bg-slate-100";

// Administración del catálogo de libros (módulo nuevo, permiso books:manage):
// crear/editar/archivar libros, subir el archivo digital de cada uno, y
// registrar compras por colecturía (ya cobradas en caja, sin aprobación
// previa — confirmado con el propietario). Mismo patrón que
// BillingAdminPage.tsx: formulario de creación con react-hook-form+zod, filas
// con acciones inline en vez de modales.
export function BooksAdminPage() {
  const {
    data: permissions,
    isLoading,
    error,
  } = useQuery<Permissions>({
    queryKey: ["me", "permissions"],
    queryFn: async () => (await apiClient.get("/me/permissions")).data,
  });

  if (isLoading) return <LoadingState label="Cargando…" />;
  if (error) return <ErrorState error={error} />;
  if (!permissions?.permissions.includes("books:manage")) {
    return (
      <ForbiddenState message="Solo administración escolar o colecturía pueden gestionar libros." />
    );
  }

  return (
    <div className="space-y-4">
      <Breadcrumbs items={[{ label: "Administración", to: "/admin" }, { label: "Libros" }]} />
      <div>
        <h1 className="font-display text-2xl font-bold text-brand-900">Libros</h1>
        <p className="text-sm text-brand-700">
          Administra el catálogo, sube el archivo digital de cada libro y registra compras por
          colecturía (pago ya recibido en caja).
        </p>
      </div>
      <BooksSection />
    </div>
  );
}

const bookSchema = z.object({
  title: z.string().min(1, "Requerido."),
  author: z.string().optional(),
  description: z.string().optional(),
  price: z
    .string()
    .min(1, "Requerido.")
    .refine((v) => Number(v) > 0, "Debe ser mayor que cero."),
});
type BookForm = z.infer<typeof bookSchema>;

function BooksSection() {
  const queryClient = useQueryClient();
  const queryKey = ["books", "admin"];
  const { data, isLoading, error } = useQuery<Book[]>({
    queryKey,
    queryFn: async () =>
      (await apiClient.get("/books", { params: { include_archived: true } })).data,
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BookForm>({ resolver: zodResolver(bookSchema) });

  const createMutation = useMutation({
    mutationFn: async (values: BookForm) =>
      (
        await apiClient.post("/books", {
          title: values.title,
          author: values.author || undefined,
          description: values.description || undefined,
          price: values.price,
        })
      ).data,
    onSuccess: () => {
      invalidate();
      reset();
    },
  });

  const statusMutation = useMutation({
    mutationFn: async ({ bookId, action }: { bookId: string; action: "archive" | "activate" }) =>
      (await apiClient.post(`/books/${bookId}/${action}`)).data,
    onSuccess: invalidate,
  });

  return (
    <section className="rounded-xl border border-brand-100 bg-white p-4">
      <h2 className="mb-3 text-base font-semibold text-brand-900">Catálogo</h2>

      <form
        onSubmit={handleSubmit((values) => createMutation.mutate(values))}
        className="mb-4 grid gap-3 sm:grid-cols-5"
        noValidate
      >
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium text-slate-600">Título</label>
          <input className={inputClass} {...register("title")} />
          {errors.title && <p className="text-xs text-red-600">{errors.title.message}</p>}
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Autor</label>
          <input className={inputClass} {...register("author")} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Precio</label>
          <input type="number" step="0.01" min="0" className={inputClass} {...register("price")} />
          {errors.price && <p className="text-xs text-red-600">{errors.price.message}</p>}
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="focus-ring w-full rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            Crear libro
          </button>
        </div>
        <div className="sm:col-span-5">
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Descripción (opcional)
          </label>
          <textarea className={inputClass} rows={2} {...register("description")} />
        </div>
      </form>
      {createMutation.isError && <ErrorState error={createMutation.error} />}

      {isLoading && <LoadingState label="Cargando libros…" />}
      {error && <ErrorState error={error} />}
      {data && data.length === 0 && (
        <EmptyState title="Sin libros todavía" description="Crea el primero arriba." />
      )}
      {data && data.length > 0 && (
        <div className="space-y-3">
          {data.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              onArchiveToggle={() =>
                statusMutation.mutate({
                  bookId: book.id,
                  action: book.status === "archived" ? "activate" : "archive",
                })
              }
              onChanged={invalidate}
            />
          ))}
        </div>
      )}
      {statusMutation.isError && <ErrorState error={statusMutation.error} />}
    </section>
  );
}

function BookCard({
  book,
  onArchiveToggle,
  onChanged,
}: {
  book: Book;
  onArchiveToggle: () => void;
  onChanged: () => void;
}) {
  const [showPurchases, setShowPurchases] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const versionsKey = ["books", book.id, "versions"];

  const uploadMutation = useMutation({
    mutationFn: async (file: globalThis.File) => {
      const formData = new FormData();
      formData.append("upload", file);
      return (await apiClient.post(`/books/${book.id}/file`, formData)).data;
    },
    onSuccess: () => {
      if (inputRef.current) inputRef.current.value = "";
      queryClient.invalidateQueries({ queryKey: versionsKey });
      onChanged();
    },
  });

  function onFileSelected(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) uploadMutation.mutate(file);
  }

  return (
    <div className="rounded-lg border border-brand-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium text-brand-900">{book.title}</p>
          <p className="text-sm text-slate-500">
            {book.author ? `${book.author} · ` : ""}
            {money(book.price)}
            {book.file_filename ? ` · ${book.file_filename}` : " · sin archivo digital"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {book.file_filename && (
            <Link to={`/books/${book.id}/read`} className={smallBtn}>
              Leer
            </Link>
          )}
          <button
            type="button"
            className={`${smallBtn} inline-flex items-center gap-1`}
            onClick={() => setShowVersions((v) => !v)}
            aria-expanded={showVersions}
          >
            Versiones
            <ChevronDownIcon
              className={`h-3.5 w-3.5 transition-transform ${showVersions ? "rotate-180" : ""}`}
            />
          </button>
          <button
            type="button"
            className={`${smallBtn} inline-flex items-center gap-1`}
            onClick={() => setShowPurchases((v) => !v)}
            aria-expanded={showPurchases}
          >
            Compras
            <ChevronDownIcon
              className={`h-3.5 w-3.5 transition-transform ${showPurchases ? "rotate-180" : ""}`}
            />
          </button>
          <button type="button" className={smallBtn} onClick={onArchiveToggle}>
            {book.status === "archived" ? "Reactivar" : "Archivar"}
          </button>
          <StatusBadge status={book.status} />
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,application/epub+zip"
          onChange={onFileSelected}
          disabled={uploadMutation.isPending}
          className="text-xs"
        />
        {uploadMutation.isPending && <p className="text-xs text-slate-500">Subiendo…</p>}
      </div>
      <p className="mt-1 text-xs text-slate-400">
        Cada archivo subido queda como una versión nueva en el historial; la primera versión de un
        libro se activa sola, las siguientes hay que activarlas desde "Ver versiones".
      </p>
      {uploadMutation.isError && <ErrorState error={uploadMutation.error} />}

      {showVersions && <BookVersionsPanel bookId={book.id} onChanged={onChanged} />}
      {showPurchases && <BookPurchasesPanel bookId={book.id} />}
    </div>
  );
}

function BookVersionsPanel({ bookId, onChanged }: { bookId: string; onChanged: () => void }) {
  const queryClient = useQueryClient();
  const versionsKey = ["books", bookId, "versions"];
  const { data, isLoading, error } = useQuery<BookFileVersion[]>({
    queryKey: versionsKey,
    queryFn: async () => (await apiClient.get(`/books/${bookId}/versions`)).data,
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ versionId, action }: { versionId: string; action: "activate" | "deactivate" }) =>
      (await apiClient.post(`/books/${bookId}/versions/${versionId}/${action}`)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: versionsKey });
      onChanged();
    },
  });

  return (
    <div className="mt-3 rounded-md bg-slate-50 p-3">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
        Historial de versiones
      </h3>
      {isLoading && <LoadingState label="Cargando versiones…" />}
      {error && <ErrorState error={error} />}
      {data && data.length === 0 && (
        <p className="text-sm text-slate-500">Todavía no se ha subido ningún archivo.</p>
      )}
      {data && data.length > 0 && (
        <ul className="space-y-1.5">
          {data.map((version) => (
            <li
              key={version.id}
              className="flex flex-wrap items-center justify-between gap-2 text-sm"
            >
              <span>
                {version.filename} · {(version.size_bytes / 1024).toFixed(0)} KB ·{" "}
                {formatDateTime(version.created_at)}
              </span>
              <span className="flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                    version.is_active
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                      : "bg-slate-100 text-slate-600 ring-slate-200"
                  }`}
                >
                  {version.is_active ? "Activa" : "Inactiva"}
                </span>
                <button
                  type="button"
                  className={smallBtn}
                  disabled={toggleMutation.isPending}
                  onClick={() =>
                    toggleMutation.mutate({
                      versionId: version.id,
                      action: version.is_active ? "deactivate" : "activate",
                    })
                  }
                >
                  {version.is_active ? "Desactivar" : "Activar"}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {toggleMutation.isError && <ErrorState error={toggleMutation.error} />}
    </div>
  );
}

function BookPurchasesPanel({ bookId }: { bookId: string }) {
  const queryClient = useQueryClient();
  const purchasesKey = ["books", bookId, "purchases"];
  const purchases = useQuery<BookPurchase[]>({
    queryKey: purchasesKey,
    queryFn: async () => (await apiClient.get(`/books/${bookId}/purchases`)).data,
  });
  const students = useQuery<StudentProfile[]>({
    queryKey: ["books", "students"],
    queryFn: async () => (await apiClient.get("/books/students")).data,
  });

  const [selectedStudentId, setSelectedStudentId] = useState("");

  const recordMutation = useMutation({
    mutationFn: async (studentId: string) =>
      (
        await apiClient.post(`/books/${bookId}/purchases/colecturia`, { student_id: studentId })
      ).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: purchasesKey });
      setSelectedStudentId("");
    },
  });

  const studentLabel = (student: StudentProfile) =>
    student.display_name ? `${student.display_name} (${student.student_number})` : student.student_number;

  return (
    <div className="mt-3 rounded-md bg-slate-50 p-3">
      <form
        className="flex flex-wrap items-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (selectedStudentId) recordMutation.mutate(selectedStudentId);
        }}
      >
        <div className="min-w-[14rem]">
          <label className="mb-1 block text-xs font-medium text-slate-600">
            Registrar compra por colecturía
          </label>
          <select
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            className={inputClass}
          >
            <option value="">Selecciona un alumno…</option>
            {(students.data ?? []).map((student) => (
              <option key={student.id} value={student.id}>
                {studentLabel(student)}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={!selectedStudentId || recordMutation.isPending}
          className="focus-ring rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          Registrar compra
        </button>
      </form>
      {students.error && <ErrorState error={students.error} />}
      {recordMutation.isError && <ErrorState error={recordMutation.error} />}

      <div className="mt-3">
        {purchases.isLoading && <LoadingState label="Cargando compras…" />}
        {purchases.error && <ErrorState error={purchases.error} />}
        {purchases.data && purchases.data.length === 0 && (
          <p className="text-sm text-slate-500">Nadie ha comprado este libro todavía.</p>
        )}
        {purchases.data && purchases.data.length > 0 && (
          <ul className="space-y-1.5">
            {purchases.data.map((purchase) => (
              <li
                key={purchase.id}
                className="flex flex-wrap items-center justify-between gap-2 text-sm"
              >
                <span>
                  {purchase.student_display_name ?? "Alumno"} ·{" "}
                  {PURCHASE_METHOD_LABEL[purchase.method] ?? purchase.method} ·{" "}
                  {money(purchase.amount)}
                </span>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
                    PURCHASE_STATUS_CLASS[purchase.status] ?? ""
                  }`}
                >
                  {PURCHASE_STATUS_LABEL[purchase.status] ?? purchase.status}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
