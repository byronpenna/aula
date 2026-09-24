import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

// Estado de sesión persistido (sección 6 de la arquitectura: "tokens preferentemente
// en memoria, sin persistir JWT en localStorage; recuperación y renovación mediante
// biblioteca; comprobar comportamiento entre recargas"). Usamos zustand + sessionStorage
// -en vez de localStorage- por lo mismo que ya hace `lib/cognitoAuth.ts` con
// `WebStorageStateStore`: sobrevive a un F5 pero se limpia al cerrar la pestaña y no
// se comparte entre pestañas/orígenes, evitando el "logout fantasma" al recargar sin
// dejar el token expuesto de forma indefinida como con localStorage.
interface SessionState {
  token: string | null;
  expiresAt: number | null;
  schoolId: string | null;
  setSession: (token: string, expiresAt: number | null) => void;
  setSchoolId: (schoolId: string | null) => void;
  clear: () => void;
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      token: null,
      expiresAt: null,
      schoolId: null,
      setSession: (token, expiresAt) => set({ token, expiresAt }),
      setSchoolId: (schoolId) => set({ schoolId }),
      clear: () => set({ token: null, expiresAt: null, schoolId: null }),
    }),
    {
      name: "aula-session",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);

export function hasValidSession(): boolean {
  const { token, expiresAt } = useSessionStore.getState();
  if (!token) return false;
  if (expiresAt !== null && Date.now() >= expiresAt) return false;
  return true;
}
