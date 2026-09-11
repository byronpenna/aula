import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { apiClient, setAuthToken, setCurrentSchoolId } from "../lib/apiClient";
import type { Me } from "../lib/types";

interface AuthState {
  me: Me | null;
  activeSchoolId: string | null;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  setActiveSchoolId: (schoolId: string) => void;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [activeSchoolId, setActiveSchoolIdState] = useState<string | null>(null);

  async function refreshMe() {
    const { data } = await apiClient.get<Me>("/me");
    setMe(data);
    if (data.memberships.length === 1) {
      setActiveSchoolIdState(data.memberships[0].school_id);
      setCurrentSchoolId(data.memberships[0].school_id);
    }
  }

  async function login(username: string, password: string) {
    // Adaptador de login local (sección 17): solo funciona con APP_ENV=local en el
    // backend. Reemplazar por Authorization Code + PKCE contra Cognito en cloud.
    const { data } = await apiClient.post("/auth/local/token", { username, password });
    setAuthToken(data.access_token);
    await refreshMe();
  }

  function logout() {
    setAuthToken(null);
    setCurrentSchoolId(null);
    setMe(null);
    setActiveSchoolIdState(null);
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
      login,
      logout,
      setActiveSchoolId,
      refreshMe,
    }),
    [me, activeSchoolId],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}
