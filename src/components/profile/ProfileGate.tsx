"use client";

/**
 * Gate de "perfil completo" (KAN-167). Envuelve cualquier parte del árbol
 * que dependa de tener un perfil completo (hoy, el dashboard placeholder de
 * `app/page.tsx`; a futuro, las vistas reales de Matches/Upload) y decide
 * qué mostrar según `useProfile().status`, sin necesitar una ruta/redirect
 * real de Next.js — mismo criterio que ya usa `app/page.tsx` para el status
 * de auth (loading/unauthenticated/authenticated).
 */

import type { ReactNode } from "react";
import { useProfile } from "@/lib/profile-context";
import { CompleteProfileForm } from "./CompleteProfileForm";

export function ProfileGate({ children }: { children: ReactNode }) {
  const { status, error, refresh } = useProfile();

  if (status === "idle" || status === "loading") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Verificando tu perfil...</p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 px-6 text-center dark:bg-black">
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="text-sm font-medium underline underline-offset-4"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (status === "incomplete") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 px-6 dark:bg-black">
        <CompleteProfileForm />
      </div>
    );
  }

  return <>{children}</>;
}
