"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { ADMIN_AUTH_MODE, PUBLIC_API_BASE_URL } from "@/lib/config";
import {
  completeCognitoSignIn,
  getCognitoUser,
  isCognitoConfigured,
  signInWithCognito,
  signOutOfCognito,
} from "@/lib/adminCognitoAuth";
import { hasValidAdminSession, useAdminSessionStore } from "@/lib/adminSession";

export type AdminAuthMode = "local" | "cognito";

interface AdminMe {
  id: string;
  display_name: string;
}

interface AdminAuthState {
  me: AdminMe | null;
  isAuthenticated: boolean;
  isInitializing: boolean;
  authMode: AdminAuthMode;
  loginLocal: (username: string, password: string) => Promise<void>;
  loginWithCognito: () => Promise<void>;
  completeCognitoCallback: () => Promise<void>;
  logout: () => void;
}

const AdminAuthContext = createContext<AdminAuthState | null>(null);

// "cognito" solo si además hay configuración real en este build (mismo fallback
// que apps/web/src/context/AuthContext.tsx): evita romper un build sin esas
// variables definidas.
const authMode: AdminAuthMode = ADMIN_AUTH_MODE === "cognito" && isCognitoConfigured ? "cognito" : "local";

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<AdminMe | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  async function refreshMe() {
    const { token } = useAdminSessionStore.getState();
    const response = await fetch(`${PUBLIC_API_BASE_URL}/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) throw new Error("No se pudo cargar la sesión.");
    const data = await response.json();
    setMe({ id: data.id, display_name: data.display_name });
  }

  useEffect(() => {
    (async () => {
      try {
        if (authMode === "cognito") {
          const user = await getCognitoUser();
          if (user) {
            useAdminSessionStore
              .getState()
              .setSession(user.access_token, user.expires_at ? user.expires_at * 1000 : null);
            await refreshMe();
          }
        } else if (hasValidAdminSession()) {
          await refreshMe();
        } else {
          useAdminSessionStore.getState().clear();
        }
      } catch {
        useAdminSessionStore.getState().clear();
      }
      setIsInitializing(false);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    })();
  }, []);

  async function loginLocal(username: string, password: string) {
    const response = await fetch(`${PUBLIC_API_BASE_URL}/auth/local/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!response.ok) {
      throw new Error("Usuario o contraseña incorrectos.");
    }
    const data = await response.json();
    useAdminSessionStore.getState().setSession(data.access_token, Date.now() + data.expires_in * 1000);
    await refreshMe();
  }

  async function loginWithCognito() {
    await signInWithCognito();
  }

  async function completeCognitoCallback() {
    const user = await completeCognitoSignIn();
    useAdminSessionStore
      .getState()
      .setSession(user.access_token, user.expires_at ? user.expires_at * 1000 : null);
    await refreshMe();
  }

  function logout() {
    useAdminSessionStore.getState().clear();
    setMe(null);
    if (authMode === "cognito") {
      void signOutOfCognito();
    }
  }

  const value = useMemo<AdminAuthState>(
    () => ({
      me,
      isAuthenticated: me !== null,
      isInitializing,
      authMode,
      loginLocal,
      loginWithCognito,
      completeCognitoCallback,
      logout,
    }),
    [me, isInitializing],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuthState {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth debe usarse dentro de <AdminAuthProvider>");
  return ctx;
}
