import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// Mismo patrón que apps/web/src/lib/session.ts: sessionStorage (no localStorage)
// para sobrevivir a un F5 sin dejar el token expuesto indefinidamente ni
// compartirlo entre pestañas/orígenes.
interface AdminSessionState {
  token: string | null;
  expiresAt: number | null;
  setSession: (token: string, expiresAt: number | null) => void;
  clear: () => void;
}

export const useAdminSessionStore = create<AdminSessionState>()(
  persist(
    (set) => ({
      token: null,
      expiresAt: null,
      setSession: (token, expiresAt) => set({ token, expiresAt }),
      clear: () => set({ token: null, expiresAt: null }),
    }),
    {
      name: "public-web-admin-session",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);

export function hasValidAdminSession(): boolean {
  const { token, expiresAt } = useAdminSessionStore.getState();
  if (!token) return false;
  if (expiresAt !== null && Date.now() >= expiresAt) return false;
  return true;
}
