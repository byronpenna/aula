import { useQuery } from "@tanstack/react-query";
import { apiClient } from "../lib/apiClient";
import type { Permissions } from "../lib/types";
import { ErrorState, LoadingState } from "../components/States";
import { useAuth } from "../context/AuthContext";

export function HomePage() {
  const { me } = useAuth();
  const { data, isLoading, error } = useQuery<Permissions>({
    queryKey: ["me", "permissions"],
    queryFn: async () => (await apiClient.get("/me/permissions")).data,
  });

  if (isLoading) return <LoadingState />;
  if (error) return <ErrorState error={error} />;

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold">Hola, {me?.display_name}</h1>
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h2 className="mb-2 text-sm font-medium text-slate-700">Tus permisos en este colegio</h2>
        <ul className="flex flex-wrap gap-2">
          {data?.permissions.map((p) => (
            <li key={p} className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
              {p}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
