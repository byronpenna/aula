"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/context/AdminAuthContext";

// Destino de redirect_uri del cliente PublicWebAdminClient (infra/lib/
// identity-stack.ts). Intercambia el `code` del Hosted UI por tokens.
export default function AdminCallbackPage() {
  const { completeCognitoCallback } = useAdminAuth();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    completeCognitoCallback()
      .then(() => router.replace("/admin"))
      .catch(() => setError("No se pudo completar el inicio de sesión con Cognito."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-brand-50 px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-brand-100">
        {error ? (
          <>
            <p role="alert" className="mb-4 text-sm text-red-600">
              {error}
            </p>
            <a className="focus-ring rounded text-brand-700 underline" href="/admin">
              Volver a intentar
            </a>
          </>
        ) : (
          <p className="text-sm text-brand-600">Completando inicio de sesión…</p>
        )}
      </div>
    </div>
  );
}
