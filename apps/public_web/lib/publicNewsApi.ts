import { PUBLIC_CONTENT_BASE_URL } from "./config";

export interface PublishedNewsPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  body: string;
  cover_image_url: string | null;
  published_at: string | null;
}

// Sin token: /public/news no exige autenticación (ver app/modules/public_site en
// apps/api). Deliberadamente no reusa adminApiClient para no mandar credenciales
// de admin a una ruta pensada para visitantes anónimos.
export async function listPublishedNews(): Promise<PublishedNewsPost[]> {
  const response = await fetch(`${PUBLIC_CONTENT_BASE_URL}/public/news`);
  if (!response.ok) {
    throw new Error("No se pudieron cargar las noticias.");
  }
  return response.json();
}
