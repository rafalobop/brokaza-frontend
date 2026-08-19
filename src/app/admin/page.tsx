"use client";

import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
import { useAdminAuth } from "@/lib/admin-auth-context";

/**
 * `/admin` (KAN-239) — solo login/sesión/logout. Las vistas reales (métricas, listado de
 * propiedades, corrección de coordenadas) son KAN-240/241/242, fuera de alcance de este ticket.
 */
export default function AdminPage() {
  const { status, admin, logout, loggingOut } = useAdminAuth();

  if (status === "loading") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Cargando...</p>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 px-6 dark:bg-black">
        <AdminLoginForm />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center gap-4 bg-zinc-50 px-6 pt-10 dark:bg-black">
      <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
        Panel admin
      </h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Sesión iniciada como {admin?.email}.
      </p>
      <button
        type="button"
        onClick={() => void logout()}
        disabled={loggingOut}
        className="text-sm font-medium underline underline-offset-4 disabled:opacity-60"
      >
        {loggingOut ? "Cerrando sesión..." : "Cerrar sesión"}
      </button>
    </div>
  );
}
