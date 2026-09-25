import { User, UserManager, WebStorageStateStore } from "oidc-client-ts";
import {
  ADMIN_COGNITO_AUTHORITY,
  ADMIN_COGNITO_CLIENT_ID,
  ADMIN_COGNITO_DOMAIN,
} from "./config";

// Authorization Code + PKCE contra el Hosted UI de Cognito, mismo User Pool que
// aula virtual pero con el cliente propio `PublicWebAdminClient` (infra/lib/
// identity-stack.ts) para poder rotar/deshabilitar uno sin afectar al otro.
export const isCognitoConfigured = Boolean(ADMIN_COGNITO_DOMAIN && ADMIN_COGNITO_CLIENT_ID);

function redirectUri(): string {
  return `${window.location.origin}/admin/callback`;
}

let cachedUserManager: UserManager | null = null;

function getUserManager(): UserManager {
  if (!isCognitoConfigured) {
    throw new Error("Cognito no está configurado en este build.");
  }
  if (!cachedUserManager) {
    cachedUserManager = new UserManager({
      authority: ADMIN_COGNITO_AUTHORITY!,
      client_id: ADMIN_COGNITO_CLIENT_ID!,
      redirect_uri: redirectUri(),
      response_type: "code",
      scope: "school-api/access",
      userStore: new WebStorageStateStore({ store: window.sessionStorage }),
      automaticSilentRenew: false,
    });
  }
  return cachedUserManager;
}

export async function signInWithCognito(): Promise<void> {
  await getUserManager().signinRedirect();
}

export async function completeCognitoSignIn(): Promise<User> {
  return getUserManager().signinCallback() as Promise<User>;
}

export async function getCognitoUser(): Promise<User | null> {
  if (!isCognitoConfigured) return null;
  const user = await getUserManager().getUser();
  return user && !user.expired ? user : null;
}

export async function signOutOfCognito(): Promise<void> {
  if (!isCognitoConfigured) return;
  await getUserManager().removeUser();
  const logoutUri = encodeURIComponent(`${window.location.origin}/admin`);
  window.location.assign(
    `${ADMIN_COGNITO_DOMAIN}/logout?client_id=${ADMIN_COGNITO_CLIENT_ID}&logout_uri=${logoutUri}`,
  );
}
