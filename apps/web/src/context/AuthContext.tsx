import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiClient, setAuthToken, setCurrentSchoolId } from "../lib/apiClient";
import {
  completeCognitoSignIn,
  getCognitoUser,
  isCognitoConfigured,
  signInWithCognito,
  signOutOfCognito,
} from "../lib/cognitoAuth";
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
  const [isInitializing, setIsInitializing] = useState(authMode === "cognito");

  async function refreshMe() {
    const { data } = await apiClient.get<Me>("/me");
    setMe(data);
    if (data.memberships.length === 1) {
      setActiveSchoolIdState(data.memberships[0].school_id);
      setCurrentSchoolId(data.memberships[0].school_id);
    }
  }

  useEffect(() => {
    if (authMode !== "cognito") return;
    // Al recargar la página, la memoria del token se pierde (sección 6); rehidrata
    // desde la sesión OIDC guardada en sessionStorage si sigue vigente.
    (async () => {
      const user = await getCognitoUser();
      if (user) {
        setAuthToken(user.access_token);
        try {
          await refreshMe();
        } catch {
          setAuthToken(null);
        }
      }
      setIsInitializing(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loginLocal(username: string, password: string) {
    // Adaptador de login local (sección 17): solo funciona con APP_ENV=local en el
    // backend.
    const { data } = await apiClient.post("/auth/local/token", { username, password });
    setAuthToken(data.access_token);
    await refreshMe();
  }

  async function loginWithCognito() {
    await signInWithCognito();
  }

  async function completeCognitoCallback() {
    const user = await completeCognitoSignIn();
    setAuthToken(user.access_token);
    await refreshMe();
  }

  function logout() {
    setAuthToken(null);
    setCurrentSchoolId(null);
    setMe(null);
    setActiveSchoolIdState(null);
    if (authMode === "cognito") {
      void signOutOfCognito();
    }
  }

  function setActiveSchoolId(schoolId: string) {
    setActiveSchoolIdState(schoolId);
    setCurrentSchoolId(schoolId);
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
