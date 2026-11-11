// Reconoce de qué proveedor es un enlace y si se puede incrustar una vista
// previa — puramente de presentación (el backend solo valida que la URL sea
// absoluta, ver learning/service.py::_validate_url). Cubre los tres casos que
// sí tienen una forma pública y oficial de incrustarse sin API key
// (YouTube/Facebook/TikTok); cualquier otra página queda como "other" y no
// se intenta incrustar — la inmensa mayoría de sitios bloquean ser mostrados
// en un iframe (X-Frame-Options/CSP frame-ancestors) y no hay forma de
// saberlo de antemano sin un backend que la visite primero.
export type LinkProvider = "youtube" | "facebook" | "tiktok" | "other";

const YOUTUBE_HOSTS = new Set([
  "www.youtube.com",
  "youtube.com",
  "m.youtube.com",
  "youtu.be",
  "www.youtu.be",
]);
const FACEBOOK_HOSTS = new Set(["www.facebook.com", "facebook.com", "m.facebook.com", "fb.watch"]);
const TIKTOK_HOSTS = new Set(["www.tiktok.com", "tiktok.com"]);
const YOUTUBE_VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;

function safeParseUrl(url: string): URL | null {
  try {
    return new URL(url.trim());
  } catch {
    return null;
  }
}

// Mismos patrones que learning/service.py::_validate_url ya acepta de
// entrada, pero aquí además se extrae el id para poder incrustar el video.
function extractYoutubeVideoId(parsed: URL): string | null {
  const host = parsed.hostname.toLowerCase();
  let videoId: string | null = null;
  if (host === "youtu.be" || host === "www.youtu.be") {
    videoId = parsed.pathname.replace(/^\//, "").split("/")[0] || null;
  } else if (parsed.pathname === "/watch") {
    videoId = parsed.searchParams.get("v");
  } else if (parsed.pathname.startsWith("/embed/")) {
    videoId = parsed.pathname.slice("/embed/".length).split("/")[0] || null;
  } else if (parsed.pathname.startsWith("/shorts/")) {
    videoId = parsed.pathname.slice("/shorts/".length).split("/")[0] || null;
  }
  return videoId && YOUTUBE_VIDEO_ID_RE.test(videoId) ? videoId : null;
}

// .../@usuario/video/1234567890123456789 — el único patrón de URL de video
// individual de TikTok (a diferencia de un perfil o la página principal).
function extractTiktokVideoId(parsed: URL): string | null {
  const match = parsed.pathname.match(/\/video\/(\d+)/);
  return match ? match[1] : null;
}

export function detectLinkProvider(url: string): LinkProvider {
  const parsed = safeParseUrl(url);
  if (!parsed) return "other";
  const host = parsed.hostname.toLowerCase();
  if (YOUTUBE_HOSTS.has(host)) return "youtube";
  if (FACEBOOK_HOSTS.has(host)) return "facebook";
  if (TIKTOK_HOSTS.has(host)) return "tiktok";
  return "other";
}

// URL para incrustar en un <iframe>, o null si no se puede (proveedor no
// reconocido, o reconocido pero sin un id de video individual identificable
// en la URL — p. ej. la portada de un perfil de TikTok).
export function getEmbedUrl(url: string): string | null {
  const parsed = safeParseUrl(url);
  if (!parsed) return null;
  const host = parsed.hostname.toLowerCase();

  if (YOUTUBE_HOSTS.has(host)) {
    const videoId = extractYoutubeVideoId(parsed);
    return videoId ? `https://www.youtube.com/embed/${videoId}` : null;
  }
  // El plugin público de video de Facebook acepta cualquier URL de video
  // público sin API key — no hace falta extraer un id propio.
  if (FACEBOOK_HOSTS.has(host)) {
    return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(url.trim())}&show_text=false`;
  }
  if (TIKTOK_HOSTS.has(host)) {
    const videoId = extractTiktokVideoId(parsed);
    return videoId ? `https://www.tiktok.com/embed/v2/${videoId}` : null;
  }
  return null;
}

// Miniatura real de YouTube (CDN pública, sin autenticación) para la
// cuadrícula de recursos; Facebook/TikTok no tienen un equivalente público
// sin llamar a su API, así que esas tarjetas caen al ícono genérico.
export function getThumbnailUrl(url: string): string | null {
  const parsed = safeParseUrl(url);
  if (!parsed || !YOUTUBE_HOSTS.has(parsed.hostname.toLowerCase())) return null;
  const videoId = extractYoutubeVideoId(parsed);
  return videoId ? `https://img.youtube.com/vi/${videoId}/mqdefault.jpg` : null;
}

export function getProviderLabel(provider: LinkProvider): string {
  switch (provider) {
    case "youtube":
      return "YouTube";
    case "facebook":
      return "Facebook";
    case "tiktok":
      return "TikTok";
    default:
      return "Enlace";
  }
}

export function getProviderBadgeClass(provider: LinkProvider): string {
  switch (provider) {
    case "youtube":
      return "bg-red-50 text-red-700 ring-red-200";
    case "facebook":
      return "bg-blue-50 text-blue-700 ring-blue-200";
    case "tiktok":
      return "bg-slate-800 text-white ring-slate-800";
    default:
      return "bg-brand-50 text-brand-700 ring-brand-200";
  }
}

export function getLinkHostname(url: string): string {
  return safeParseUrl(url)?.hostname.replace(/^www\./, "") ?? url;
}

// Mismo chequeo mínimo que learning/service.py::_validate_url (esquema
// http/https + host), solo para habilitar el botón "Agregar" en el momento;
// el backend vuelve a validar al recibir la petición.
export function isAbsoluteHttpUrl(url: string): boolean {
  const parsed = safeParseUrl(url);
  return Boolean(parsed && (parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.hostname);
}
