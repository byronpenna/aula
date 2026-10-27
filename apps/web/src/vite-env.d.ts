/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  /** "cognito" en cloud, cualquier otro valor (u omitido) usa el login local. */
  readonly VITE_AUTH_MODE?: string;
  /** Issuer del User Pool para discovery OIDC (infra/lib/identity-stack.ts). */
  readonly VITE_COGNITO_AUTHORITY?: string;
  readonly VITE_COGNITO_CLIENT_ID?: string;
  /** Dominio Hosted UI, para el endpoint /logout (no cubierto por discovery). */
  readonly VITE_COGNITO_DOMAIN?: string;
  /** Llave pública de Wompi (módulo "libros"); sin definir, el checkout en línea
   * se muestra deshabilitado (ver routes/BookDetailPage.tsx). */
  readonly VITE_WOMPI_PUBLIC_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
