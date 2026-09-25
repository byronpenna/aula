"use client";

import { useEffect, useState } from "react";
import { listPublishedNews, type PublishedNewsPost } from "@/lib/publicNewsApi";

export function NewsList() {
  const [news, setNews] = useState<PublishedNewsPost[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listPublishedNews()
      .then(setNews)
      .catch(() => setError("No se pudieron cargar las noticias en este momento."));
  }, []);

  if (error) {
    return <p className="mt-8 text-sm text-red-600">{error}</p>;
  }

  if (news === null) {
    return <p className="mt-8 text-sm text-brand-500">Cargando noticias…</p>;
  }

  if (news.length === 0) {
    return <p className="mt-8 text-sm text-brand-500">Aún no hay noticias publicadas.</p>;
  }

  return (
    <div className="mt-10 grid gap-6">
      {news.map((item) => (
        <article
          key={item.id}
          className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-brand-100 sm:p-8"
        >
          {item.published_at && (
            <p className="text-xs font-semibold uppercase tracking-wide text-accent-500">
              {new Date(item.published_at).toLocaleDateString("es-SV", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
          )}
          <h2 className="font-display mt-1 text-xl font-bold text-brand-900 sm:text-2xl">
            {item.title}
          </h2>
          {item.cover_image_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.cover_image_url}
              alt={item.title}
              className="mt-4 max-h-96 w-full rounded-xl object-cover"
            />
          )}
          <p className="mt-4 whitespace-pre-line text-brand-700">{item.body}</p>
        </article>
      ))}
    </div>
  );
}
