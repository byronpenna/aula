import axios from "axios";

// El token vive solo en memoria (nunca localStorage), como pide la sección 6 del
// documento de arquitectura. Se pierde al recargar la página: eso es intencional
// para este MVP local; la recuperación real de sesión llegará con Cognito.
let inMemoryToken: string | null = null;
let currentSchoolId: string | null = null;

export function setAuthToken(token: string | null) {
  inMemoryToken = token;
}

export function getAuthToken(): string | null {
  return inMemoryToken;
}

export function setCurrentSchoolId(schoolId: string | null) {
  currentSchoolId = schoolId;
}

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1",
});

apiClient.interceptors.request.use((config) => {
  if (inMemoryToken) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${inMemoryToken}`;
  }
  if (currentSchoolId) {
    config.headers = config.headers ?? {};
    config.headers["X-School-Id"] = currentSchoolId;
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
