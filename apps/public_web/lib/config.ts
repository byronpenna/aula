export const AULA_VIRTUAL_URL =
  process.env.NEXT_PUBLIC_AULA_URL ?? "https://main.dy880wnmeoiy1.amplifyapp.com";

// API de aula virtual (apps/api): el área admin de este sitio la reusa para
// noticias, contra el schema Postgres separado `content` (mismo Postgres, otro
// límite de dominio; ver app/modules/public_site en apps/api).
export const PUBLIC_API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1";

// Raíz del HTTP API (sin /api/v1): las rutas públicas de solo lectura
// (/public/news) viven fuera de ese prefijo a propósito, sin autorizador de
// Cognito (infra/lib/api-stack.ts) — visitantes anónimos del sitio.
export const PUBLIC_CONTENT_BASE_URL = PUBLIC_API_BASE_URL.replace(/\/api\/v1\/?$/, "");

// Auth del área admin (sección 6/17, igual patrón que apps/web): "cognito" en
// cloud contra el Hosted UI de infra/lib/identity-stack.ts (PublicWebAdminClient),
// "local" en desarrollo contra /auth/local/token (requiere APP_ENV=local en la API).
export const ADMIN_AUTH_MODE = process.env.NEXT_PUBLIC_AUTH_MODE === "cognito" ? "cognito" : "local";
export const ADMIN_COGNITO_AUTHORITY = process.env.NEXT_PUBLIC_COGNITO_AUTHORITY;
export const ADMIN_COGNITO_CLIENT_ID = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
export const ADMIN_COGNITO_DOMAIN = process.env.NEXT_PUBLIC_COGNITO_DOMAIN;

export const SCHOOL_NAME = "Colegio Coronel Francisco Linares";
export const SCHOOL_SHORT_NAME = "Colegio Linares";

export const SCHOOL_ADDRESS =
  "Carretera Troncal del Norte, kilómetro 13, cantón San Nicolás, Apopa, San Salvador";
export const SCHOOL_PHONE = "+503 2203 7402";
export const SCHOOL_PHONE_HREF = "+50322037402";

// TODO(propietario): el link de "horario de atención" recibido apunta al mismo
// perfil de TikTok que SCHOOL_TIKTOK_URL — probablemente un copy/paste
// duplicado. Se deja el dato de horario sin publicar hasta confirmar el
// horario real o el link correcto (ver docs/ASSUMPTIONS.md).
export const SCHOOL_SCHEDULE: string | null = null;

export const SCHOOL_WAZE_URL =
  "https://www.waze.com/es/live-map/directions/colegio-coronel-francisco-linares-apopa?to=place.w.177471626.1774912869.1923016";
export const SCHOOL_GOOGLE_MAPS_URL =
  "https://www.google.com/maps/place/Centro+Escolar+Coronel+Francisco+Linares/data=!4m2!3m1!1s0x0:0xd42fe69872f322ae?sa=X&ved=1t:2428&ictx=111";
export const SCHOOL_FACEBOOK_URL = "https://www.facebook.com/ColegioFranciscoLinares";
export const SCHOOL_TIKTOK_URL = "https://www.tiktok.com/@colegio.linares";
