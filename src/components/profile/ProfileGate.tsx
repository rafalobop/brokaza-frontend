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
import { Loader } from "@/components/ui/Loader";
import { CompleteProfileForm } from "./CompleteProfileForm";
import { PendingValidationScreen } from "./PendingValidationScreen";

export function ProfileGate({ children }: { children: ReactNode }) {
  const { status, error, refresh } = useProfile();

  if (status === "idle" || status === "loading") {
    return <Loader label="Verificando tu perfil..." />;
  }

  if (status === "error") {
    return (
      <div className="bg-background flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-error text-sm">{error}</p>
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
      <div className="bg-background flex flex-1 flex-col items-center justify-center gap-6 px-6">
        <CompleteProfileForm />
      </div>
    );
  }

  // KAN-306 (AC5): cuenta guardada pero con la matrícula todavía pendiente de validar contra el
  // padrón — no tiene sentido volver a mostrar el formulario de completar perfil.
  if (status === "pending_validation") {
    return (
      <div className="bg-background flex flex-1 flex-col items-center justify-center gap-6 px-6">
        <PendingValidationScreen />
      </div>
    );
  }

  return <>{children}</>;
}
