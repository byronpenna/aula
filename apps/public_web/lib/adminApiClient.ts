import axios from "axios";
import { PUBLIC_API_BASE_URL } from "./config";
import { useAdminSessionStore } from "./adminSession";

export const adminApiClient = axios.create({ baseURL: PUBLIC_API_BASE_URL });

adminApiClient.interceptors.request.use((config) => {
  const { token } = useAdminSessionStore.getState();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
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

adminApiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAdminSessionStore.getState().clear();
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
