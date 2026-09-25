"use client";

import { useState, type FormEvent } from "react";
import { useAdminAuth } from "@/context/AdminAuthContext";

export function LoginPanel() {
  const { authMode, loginLocal, loginWithCognito } = useAdminAuth();

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-sm ring-1 ring-brand-100">
        <h1 className="font-display text-xl font-bold text-brand-900">Administración del sitio</h1>
        <p className="mt-1 text-sm text-brand-600">Colegio Coronel Francisco Linares</p>

        <div className="mt-6">
          {authMode === "cognito" ? (
            <CognitoPanel onLogin={loginWithCognito} />
          ) : (
            <LocalLoginForm onLogin={loginLocal} />
          )}
        </div>
      </div>
    </div>
  );
}

function CognitoPanel({ onLogin }: { onLogin: () => Promise<void> }) {
  const [error, setError] = useState<string | null>(null);
  const [isRedirecting, setIsRedirecting] = useState(false);

  async function handleClick() {
    setError(null);
    setIsRedirecting(true);
    try {
      await onLogin();
    } catch {
      setError("No se pudo iniciar el flujo de inicio de sesión.");
      setIsRedirecting(false);
    }
  }

  return (
    <div>
      {error && (
        <p role="alert" className="mb-3 text-sm text-red-600">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={handleClick}
        disabled={isRedirecting}
        className="focus-ring w-full rounded-full bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-900 disabled:opacity-60"
      >
        {isRedirecting ? "Redirigiendo…" : "Iniciar sesión"}
      </button>
    </div>
  );
}

function LocalLoginForm({
  onLogin,
}: {
  onLogin: (username: string, password: string) => Promise<void>;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await onLogin(username, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar sesión.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <p className="mb-4 text-xs text-brand-500">
        Ingreso de desarrollo local (adaptador temporal, no Cognito).
      </p>

      <label className="mb-1 block text-sm font-medium text-brand-800" htmlFor="admin-username">
        Usuario
      </label>
      <input
        id="admin-username"
        className="focus-ring mb-3 w-full rounded-md border border-brand-200 px-3 py-2 text-sm"
        autoComplete="username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
      />

      <label className="mb-1 block text-sm font-medium text-brand-800" htmlFor="admin-password">
        Contraseña
      </label>
      <input
        id="admin-password"
        type="password"
        className="focus-ring mb-1 w-full rounded-md border border-brand-200 px-3 py-2 text-sm"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />

      {error && (
        <p role="alert" className="mt-3 text-sm text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isSubmitting}
        className="focus-ring mt-5 w-full rounded-full bg-brand-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-900 disabled:opacity-60"
      >
        {isSubmitting ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
