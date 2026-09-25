"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useAdminAuth } from "@/context/AdminAuthContext";
import { ApiError } from "@/lib/adminApiClient";
import {
  createNews,
  deleteNews,
  listNews,
  updateNews,
  type NewsPost,
  type NewsPostInput,
  type NewsStatus,
} from "@/lib/newsApi";

const EMPTY_FORM: NewsPostInput = { title: "", excerpt: "", body: "", cover_image_url: "", status: "draft" };

export function NewsManager() {
  const { me, logout } = useAdminAuth();
  const [news, setNews] = useState<NewsPost[] | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<NewsPostInput>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  async function reload() {
    try {
      setNews(await listNews());
      setForbidden(false);
      setLoadError(null);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setForbidden(true);
      } else {
        setLoadError("No se pudieron cargar las noticias.");
      }
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError(null);
  }

  function startEdit(item: NewsPost) {
    setEditingId(item.id);
    setForm({
      title: item.title,
      excerpt: item.excerpt ?? "",
      body: item.body,
      cover_image_url: item.cover_image_url ?? "",
      status: item.status,
    });
    setFormError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setIsSaving(true);
    try {
      const payload: NewsPostInput = {
        ...form,
        excerpt: form.excerpt || undefined,
        cover_image_url: form.cover_image_url || undefined,
      };
      if (editingId) {
        await updateNews(editingId, payload);
      } else {
        await createNews(payload);
      }
      startCreate();
      await reload();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "No se pudo guardar la noticia.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!window.confirm("¿Eliminar esta noticia? Esta acción no se puede deshacer.")) return;
    await deleteNews(id);
    if (editingId === id) startCreate();
    await reload();
  }

  if (forbidden) {
    return (
      <AdminShell me={me?.display_name} onLogout={logout}>
        <p className="rounded-xl bg-white p-6 text-sm text-brand-700 ring-1 ring-brand-100">
          Tu cuenta no tiene permiso para administrar el sitio público (se requiere el permiso{" "}
          <code className="rounded bg-brand-50 px-1">public_site:manage</code>).
        </p>
      </AdminShell>
    );
  }

  return (
    <AdminShell me={me?.display_name} onLogout={logout}>
      <div className="grid gap-8 lg:grid-cols-[1fr_1.2fr]">
        <form
          onSubmit={handleSubmit}
          className="h-fit rounded-2xl bg-white p-6 shadow-sm ring-1 ring-brand-100"
        >
          <h2 className="font-display text-lg font-bold text-brand-900">
            {editingId ? "Editar noticia" : "Nueva noticia"}
          </h2>

          <label className="mt-4 block text-sm font-medium text-brand-800" htmlFor="news-title">
            Título
          </label>
          <input
            id="news-title"
            required
            className="focus-ring mt-1 w-full rounded-md border border-brand-200 px-3 py-2 text-sm"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />

          <label className="mt-3 block text-sm font-medium text-brand-800" htmlFor="news-excerpt">
            Resumen (opcional)
          </label>
          <input
            id="news-excerpt"
            className="focus-ring mt-1 w-full rounded-md border border-brand-200 px-3 py-2 text-sm"
            value={form.excerpt}
            onChange={(e) => setForm({ ...form, excerpt: e.target.value })}
          />

          <label className="mt-3 block text-sm font-medium text-brand-800" htmlFor="news-body">
            Contenido
          </label>
          <textarea
            id="news-body"
            required
            rows={6}
            className="focus-ring mt-1 w-full rounded-md border border-brand-200 px-3 py-2 text-sm"
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
          />

          <label className="mt-3 block text-sm font-medium text-brand-800" htmlFor="news-cover">
            URL de imagen de portada (opcional)
          </label>
          <input
            id="news-cover"
            className="focus-ring mt-1 w-full rounded-md border border-brand-200 px-3 py-2 text-sm"
            value={form.cover_image_url}
            onChange={(e) => setForm({ ...form, cover_image_url: e.target.value })}
          />

          <label className="mt-3 block text-sm font-medium text-brand-800" htmlFor="news-status">
            Estado
          </label>
          <select
            id="news-status"
            className="focus-ring mt-1 w-full rounded-md border border-brand-200 px-3 py-2 text-sm"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as NewsStatus })}
          >
            <option value="draft">Borrador</option>
            <option value="published">Publicada</option>
          </select>

          {formError && (
            <p role="alert" className="mt-3 text-sm text-red-600">
              {formError}
            </p>
          )}

          <div className="mt-5 flex gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="focus-ring rounded-full bg-brand-800 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-900 disabled:opacity-60"
            >
              {isSaving ? "Guardando…" : editingId ? "Guardar cambios" : "Crear noticia"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={startCreate}
                className="focus-ring rounded-full px-4 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>

        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-brand-100">
          <h2 className="font-display text-lg font-bold text-brand-900">Noticias</h2>

          {loadError && <p className="mt-3 text-sm text-red-600">{loadError}</p>}
          {news === null && !loadError && <p className="mt-3 text-sm text-brand-500">Cargando…</p>}
          {news?.length === 0 && <p className="mt-3 text-sm text-brand-500">Aún no hay noticias.</p>}

          <ul className="mt-3 divide-y divide-brand-100">
            {news?.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-brand-900">{item.title}</p>
                  <p className="mt-0.5 text-xs text-brand-500">
                    <span
                      className={
                        item.status === "published"
                          ? "rounded-full bg-accent-400/20 px-2 py-0.5 font-medium text-accent-500"
                          : "rounded-full bg-brand-100 px-2 py-0.5 font-medium text-brand-600"
                      }
                    >
                      {item.status === "published" ? "Publicada" : "Borrador"}
                    </span>{" "}
                    · creada {new Date(item.created_at).toLocaleDateString("es-SV")}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2 text-sm font-semibold">
                  <button
                    type="button"
                    onClick={() => startEdit(item)}
                    className="focus-ring rounded-full px-3 py-1 text-brand-700 hover:bg-brand-50"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(item.id)}
                    className="focus-ring rounded-full px-3 py-1 text-red-600 hover:bg-red-50"
                  >
                    Eliminar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </AdminShell>
  );
}

function AdminShell({
  me,
  onLogout,
  children,
}: {
  me?: string;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-brand-50">
      <header className="border-b border-brand-100 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div>
            <p className="font-display text-sm font-bold text-brand-900">Administración del sitio</p>
            <p className="text-xs text-brand-500">Colegio Coronel Francisco Linares</p>
          </div>
          <div className="flex items-center gap-3 text-sm">
            {me && <span className="text-brand-600">{me}</span>}
            <button
              type="button"
              onClick={onLogout}
              className="focus-ring rounded-full px-3 py-1.5 font-semibold text-brand-700 hover:bg-brand-50"
            >
              Cerrar sesión
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
