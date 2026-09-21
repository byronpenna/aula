import { User, UserManager, WebStorageStateStore } from "oidc-client-ts";

// Authorization Code + PKCE contra el Hosted UI de Cognito (sección 6/17 de la
// arquitectura), reemplazando el adaptador de login local fuera de APP_ENV=local.
//
// El estado de la sesión OIDC (code_verifier, nonce, tokens) se guarda en
// sessionStorage, no localStorage: es la única forma de sobrevivir a la
// redirección de página completa hacia el Hosted UI y de vuelta (la memoria del
// proceso se pierde en ese salto), pero sessionStorage se limpia al cerrar la
// pestaña y no se comparte entre pestañas/orígenes, manteniendo la intención de
// "nunca localStorage" de apiClient.ts lo más cerca posible de un token en memoria.
const cognitoDomain = import.meta.env.VITE_COGNITO_DOMAIN;
const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID;

export const isCognitoConfigured = Boolean(cognitoDomain && clientId);

export const userManager = isCognitoConfigured
  ? new UserManager({
      // isCognitoConfigured ya garantiza que ambos existen.
      authority: import.meta.env.VITE_COGNITO_AUTHORITY!,
      client_id: clientId!,
      redirect_uri: `${window.location.origin}/callback`,
      response_type: "code",
      // Solo el scope del resource server que la API valida (settings.api_scope).
      // "openid" no está habilitado en SpaClient (identity-stack.ts) — pedirlo
      // aquí sin habilitarlo allá responde invalid_scope; y no hace falta: no
      // usamos el id_token, la API exige token_use=access (core/security.py).
      scope: "school-api/access",
      userStore: new WebStorageStateStore({ store: window.sessionStorage }),
      automaticSilentRenew: false,
    })
  : null;

export async function signInWithCognito(): Promise<void> {
  if (!userManager) throw new Error("Cognito no está configurado en este build.");
  await userManager.signinRedirect();
}

export async function completeCognitoSignIn(): Promise<User> {
  if (!userManager) throw new Error("Cognito no está configurado en este build.");
  return userManager.signinCallback() as Promise<User>;
}

export async function getCognitoUser(): Promise<User | null> {
  if (!userManager) return null;
  const user = await userManager.getUser();
  return user && !user.expired ? user : null;
}

export async function signOutOfCognito(): Promise<void> {
  if (!userManager) return;
  await userManager.removeUser();
  // No se usa userManager.signoutRedirect(): el `end_session_endpoint` que expone
  // el discovery document de Cognito sigue semántica OIDC estándar
  // (id_token_hint/post_logout_redirect_uri), pero el endpoint /logout real de
  // Cognito espera sus propios parámetros (client_id/logout_uri) — se arma a mano.
  const logoutUri = encodeURIComponent(`${window.location.origin}/`);
  window.location.assign(`${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${logoutUri}`);
}
