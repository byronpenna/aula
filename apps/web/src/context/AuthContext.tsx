import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiClient } from "../lib/apiClient";
import {
  completeCognitoSignIn,
  getCognitoUser,
  isCognitoConfigured,
  signInWithCognito,
  signOutOfCognito,
} from "../lib/cognitoAuth";
import { hasValidSession, useSessionStore } from "../lib/session";
import type { Me } from "../lib/types";

// Modo de autenticación (sección 6/17): "cognito" en cloud (dev/staging/prod,
// build con VITE_AUTH_MODE=cognito en apps/web/.env.production), "local" en
// desarrollo local contra el adaptador de /auth/local/token (solo APP_ENV=local
// en el backend). Un build de cloud sin Cognito configurado cae a "local" para no
// romper `npm run build`, pero ese modo siempre respondería 401 contra esa API.
export type AuthMode = "local" | "cognito";
const authMode: AuthMode =
  import.meta.env.VITE_AUTH_MODE === "cognito" && isCognitoConfigured ? "cognito" : "local";

interface AuthState {
  me: Me | null;
  activeSchoolId: string | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  authMode: AuthMode;
  loginLocal: (username: string, password: string) => Promise<void>;
  loginWithCognito: () => Promise<void>;
  completeCognitoCallback: () => Promise<void>;
  logout: () => void;
  setActiveSchoolId: (schoolId: string) => void;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [activeSchoolId, setActiveSchoolIdState] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  async function refreshMe() {
    const { data } = await apiClient.get<Me>("/me");
    setMe(data);
    const persistedSchoolId = useSessionStore.getState().schoolId;
    const stillActive = data.memberships.some((m) => m.school_id === persistedSchoolId);
    if (stillActive && persistedSchoolId) {
      setActiveSchoolIdState(persistedSchoolId);
    } else if (data.memberships.length === 1) {
      setActiveSchoolIdState(data.memberships[0].school_id);
      useSessionStore.getState().setSchoolId(data.memberships[0].school_id);
    }
  }

  useEffect(() => {
    // Al recargar la página, el estado de React se pierde; rehidrata la sesión
    // desde sessionStorage (vía `lib/session.ts`, o la sesión OIDC de
    // `lib/cognitoAuth.ts` en modo Cognito) si sigue vigente.
    (async () => {
      try {
        if (authMode === "cognito") {
          const user = await getCognitoUser();
          if (user) {
            useSessionStore
              .getState()
              .setSession(user.access_token, user.expires_at ? user.expires_at * 1000 : null);
            await refreshMe();
          }
        } else if (hasValidSession()) {
          await refreshMe();
        } else {
          useSessionStore.getState().clear();
        }
      } catch {
        useSessionStore.getState().clear();
      }
      setIsInitializing(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Si el token se limpia a mitad de sesión (401 de la API, ver apiClient.ts), la
  // vista debe reflejarlo de inmediato en vez de esperar a la próxima recarga.
  useEffect(() => {
    return useSessionStore.subscribe((state) => {
      if (!state.token) {
        setMe((current) => (current ? null : current));
        setActiveSchoolIdState((current) => (current ? null : current));
      }
    });
  }, []);

  async function loginLocal(username: string, password: string) {
    // Adaptador de login local (sección 17): solo funciona con APP_ENV=local en el
    // backend.
    const { data } = await apiClient.post("/auth/local/token", { username, password });
    const expiresAt = Date.now() + data.expires_in * 1000;
    useSessionStore.getState().setSession(data.access_token, expiresAt);
    await refreshMe();
  }

  async function loginWithCognito() {
    await signInWithCognito();
  }

  async function completeCognitoCallback() {
    const user = await completeCognitoSignIn();
    useSessionStore
      .getState()
      .setSession(user.access_token, user.expires_at ? user.expires_at * 1000 : null);
    await refreshMe();
  }

  function logout() {
    useSessionStore.getState().clear();
    setMe(null);
    setActiveSchoolIdState(null);
    if (authMode === "cognito") {
      void signOutOfCognito();
    }
  }

  function setActiveSchoolId(schoolId: string) {
    setActiveSchoolIdState(schoolId);
    useSessionStore.getState().setSchoolId(schoolId);
  }

  const value = useMemo<AuthState>(
    () => ({
      me,
      activeSchoolId,
      isAuthenticated: me !== null,
      isInitializing,
      authMode,
      loginLocal,
      loginWithCognito,
      completeCognitoCallback,
      logout,
      setActiveSchoolId,
      refreshMe,
    }),
    [me, activeSchoolId, isInitializing],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
