import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useAuth } from "../context/AuthContext";
import { apiClient } from "../lib/apiClient";
import type { Me, MeUpdate } from "../lib/types";
import { ErrorState } from "../components/States";

// Autoservicio (sección "cualquier usuario, sin importar su rol"): elegir un
// @handle propio para poder ser mencionado/tageado — vive fuera de Administración
// > Usuarios porque no requiere USERS_MANAGE (ver `PATCH /me` en identity/router.py).
export function MyProfilePage() {
  const { me, refreshMe } = useAuth();
  const [handleInput, setHandleInput] = useState(me?.handle ?? "");

  const mutation = useMutation({
    mutationFn: async (handle: string) =>
      (await apiClient.patch<Me>("/me", { handle: handle.trim() || null } satisfies MeUpdate)).data,
    onSuccess: async () => {
      await refreshMe();
    },
  });

  if (!me) return null;

  return (
    <div className="max-w-md space-y-4">
      <h1 className="font-display text-2xl font-bold text-brand-900">Mi perfil</h1>
      <div className="rounded-xl border border-brand-100 bg-white p-5">
        <p className="text-sm text-slate-700">{me.display_name}</p>
        {me.email && <p className="text-xs text-slate-500">{me.email}</p>}

        <label className="mt-4 block text-sm font-medium text-slate-700" htmlFor="handle">
          Mi usuario (para que te puedan mencionar)
        </label>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-slate-400">@</span>
          <input
            id="handle"
            className="focus-ring w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm"
            placeholder="byronpena"
            value={handleInput}
            onChange={(e) => setHandleInput(e.target.value)}
          />
        </div>
        <p className="mt-1 text-xs text-slate-500">
          3-20 caracteres, empieza con una letra: solo letras, números o guion bajo.
        </p>

        {mutation.isError && <ErrorState error={mutation.error} />}
        {mutation.isSuccess && (
          <p className="mt-2 text-sm text-green-700">Usuario actualizado.</p>
        )}

        <button
          type="button"
          disabled={mutation.isPending}
          onClick={() => mutation.mutate(handleInput)}
          className="focus-ring mt-3 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-60"
        >
          {mutation.isPending ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </div>
  );
}
