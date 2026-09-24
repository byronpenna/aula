import axios from "axios";
import { useSessionStore } from "./session";

// El token y el colegio activo se leen del store de sesión (`lib/session.ts`), que
// los persiste en sessionStorage en vez de mantenerlos en variables de módulo: así
// sobreviven a un F5 sin caer en localStorage (sección 6 de la arquitectura).
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1",
});

apiClient.interceptors.request.use((config) => {
  const { token, schoolId } = useSessionStore.getState();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  if (schoolId) {
    config.headers = config.headers ?? {};
    config.headers["X-School-Id"] = schoolId;
  }
  return config;
});

export class ApiError extends Error {
  code: string;
  status: number;
  details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token vencido o revocado a mitad de sesión: se limpia para que el próximo
      // render de <AppShell> redirija a /login en vez de seguir reintentando con un
      // token que el servidor ya no acepta.
      useSessionStore.getState().clear();
    }
    if (error.response?.data?.error) {
      const { code, message, details } = error.response.data.error;
      return Promise.reject(new ApiError(error.response.status, code, message, details));
    }
    if (!error.response) {
      return Promise.reject(new ApiError(0, "OFFLINE", "Sin conexión con el servidor."));
    }
    return Promise.reject(error);
  },
);
