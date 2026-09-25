"use client";

import { useAdminAuth } from "@/context/AdminAuthContext";
import { LoginPanel } from "@/components/admin/LoginPanel";
import { NewsManager } from "@/components/admin/NewsManager";

export default function AdminPage() {
  const { isAuthenticated, isInitializing } = useAdminAuth();

  if (isInitializing) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-brand-50">
        <p className="text-sm text-brand-500">Cargando…</p>
      </div>
    );
  }

  return isAuthenticated ? <NewsManager /> : <LoginPanel />;
}
