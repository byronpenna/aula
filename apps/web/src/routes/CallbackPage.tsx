import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

// Destino de redirect_uri del cliente SPA de Cognito (infra/bin/aula.ts:
// callbackUrls). Intercambia el `code` del Hosted UI por tokens y entra a la app.
export function CallbackPage() {
  const { completeCognitoCallback } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    completeCognitoCallback()
      .then(() => navigate("/", { replace: true }))
      .catch(() => setError("No se pudo completar el inicio de sesión con Cognito."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 text-center shadow-sm">
        {error ? (
          <>
            <p role="alert" className="mb-4 text-sm text-red-600">
              {error}
            </p>
            <a className="focus-ring rounded text-sky-700 underline" href="/login">
              Volver a intentar
            </a>
          </>
        ) : (
          <p className="text-sm text-slate-500">Completando inicio de sesión…</p>
        )}
      </div>
    </div>
  );
}
