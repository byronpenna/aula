import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { ApiError } from "../lib/apiClient";

const schema = z.object({
  username: z.string().min(1, "Ingresa tu usuario."),
  password: z.string().min(1, "Ingresa tu contraseña."),
});

type FormValues = z.infer<typeof schema>;

// Mismo logo/nombre que el header de AppShell.tsx: es lo primero que ve
// cualquier usuario, así que debe sentirse como la misma plataforma desde el
// primer segundo, no como una pantalla de login genérica sin marca.
function LoginBrandHeader() {
  return (
    <div className="mb-6 flex flex-col items-center text-center">
      <img
        src="/img/logo.jpg"
        alt="Colegio Linares"
        width={56}
        height={56}
        className="h-14 w-14 rounded-full object-cover shadow-sm"
      />
      <h1 className="mt-3 font-display text-xl font-bold text-brand-900">Colegio Linares</h1>
      <p className="text-sm text-brand-700">Aula Virtual</p>
    </div>
  );
}

export function LoginPage() {
  const { authMode, loginLocal, loginWithCognito } = useAuth();

  if (authMode === "cognito") {
    return <CognitoLoginPanel onLogin={loginWithCognito} />;
  }
  return <LocalLoginForm onLogin={loginLocal} />;
}

function CognitoLoginPanel({ onLogin }: { onLogin: () => Promise<void> }) {
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
    <div className="flex min-h-screen items-center justify-center bg-brand-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-brand-100 bg-white p-8 text-center shadow-sm">
        <LoginBrandHeader />
        <p className="mb-6 text-sm text-slate-500">Inicia sesión con tu cuenta del colegio.</p>

        {error && (
          <p role="alert" className="mb-3 text-sm text-red-600">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={handleClick}
          disabled={isRedirecting}
          className="focus-ring w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {isRedirecting ? "Redirigiendo…" : "Iniciar sesión"}
        </button>
      </div>
    </div>
  );
}

function LocalLoginForm({
  onLogin,
}: {
  onLogin: (username: string, password: string) => Promise<void>;
}) {
  const navigate = useNavigate();
  const [serverError, setServerError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  async function onSubmit(values: FormValues) {
    setServerError(null);
    try {
      await onLogin(values.username, values.password);
      navigate("/");
    } catch (error) {
      setServerError(error instanceof ApiError ? error.message : "No se pudo iniciar sesión.");
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-50 px-4">
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="w-full max-w-sm rounded-xl border border-brand-100 bg-white p-8 shadow-sm"
        noValidate
      >
        <LoginBrandHeader />
        <p className="mb-6 text-center text-sm text-slate-500">
          Ingreso de desarrollo local (adaptador temporal, no Cognito).
        </p>

        <label className="mb-1 block text-sm font-medium text-slate-700" htmlFor="username">
          Usuario
        </label>
        <input
          id="username"
          className="focus-ring mb-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          autoComplete="username"
          {...register("username")}
        />
        {errors.username && (
          <p className="mb-2 text-sm text-red-600">{errors.username.message}</p>
        )}

        <label className="mb-1 mt-3 block text-sm font-medium text-slate-700" htmlFor="password">
          Contraseña
        </label>
        <input
          id="password"
          type="password"
          className="focus-ring mb-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          autoComplete="current-password"
          {...register("password")}
        />
        {errors.password && (
          <p className="mb-2 text-sm text-red-600">{errors.password.message}</p>
        )}

        {serverError && (
          <p role="alert" className="mt-3 text-sm text-red-600">
            {serverError}
          </p>
        )}

        <button
          type="submit"
          disabled={isSubmitting}
          className="focus-ring mt-5 w-full rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {isSubmitting ? "Ingresando…" : "Ingresar"}
        </button>

        <p className="mt-4 text-xs text-slate-400">
          Usuarios de prueba tras `make seed`: admin.demo, docente.demo, alumno.demo,
          tutor.demo — contraseña: aula-local-dev.
        </p>
      </form>
    </div>
  );
}
