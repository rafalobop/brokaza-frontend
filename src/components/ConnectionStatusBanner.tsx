"use client";

/**
 * Aviso proactivo de conectividad (KAN-325) — escucha `online`/`offline` del browser y muestra un
 * toast no bloqueante ("Sin conexión" / "Conectado") en vez de dejar que el usuario se entere recién
 * cuando una acción falla silenciosamente. Se monta en `app/layout.tsx` (no en `(dashboard)/layout.tsx`
 * ni `admin/layout.tsx`) porque la conectividad importa incluso antes de loguearse (ver `LoginForm`).
 *
 * Fixed + `pointer-events-none` en el wrapper (solo el toast en sí capta clicks): no empuja
 * contenido ni tapa el resto de la UI, así conviven varios avisos a la vez sin pisarse (AC "no
 * interfiere con otros mensajes" / "no oculta información crítica").
 */

import { useEffect, useRef, useState } from "react";

// Los eventos online/offline del browser pueden dispararse varias veces seguidas en una conexión
// inestable (wifi entrando y saliendo de rango) — sin este debounce el banner parpadearía en cada
// toggle en vez de asentarse en el estado real.
const DEBOUNCE_MS = 500;
// AC "desaparece automáticamente después de un tiempo configurable": es un aviso puntual, no un
// indicador de estado persistente — por eso también se autooculta estando offline, no solo al
// reconectar. Configurable vía prop para tests / casos de uso futuros.
const DEFAULT_AUTO_HIDE_MS = 6000;

type ConnectionState = "online" | "offline";

interface ConnectionStatusBannerProps {
  autoHideMs?: number;
}

export function ConnectionStatusBanner({
  autoHideMs = DEFAULT_AUTO_HIDE_MS,
}: ConnectionStatusBannerProps) {
  const [visibleState, setVisibleState] = useState<ConnectionState | null>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Arranca en "online" a propósito (no lee `navigator.onLine` acá): el chequeo real ocurre en el
  // useEffect de abajo, que si el browser ya está offline al montar dispara `scheduleUpdate`
  // igual que un evento real, sin duplicar la lógica de debounce/auto-hide.
  const lastKnownState = useRef<ConnectionState>("online");

  useEffect(() => {
    function scheduleUpdate(next: ConnectionState): void {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        if (next === lastKnownState.current) return;
        lastKnownState.current = next;
        setVisibleState(next);

        if (hideTimer.current) clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => setVisibleState(null), autoHideMs);
      }, DEBOUNCE_MS);
    }

    function handleOffline(): void {
      scheduleUpdate("offline");
    }
    function handleOnline(): void {
      scheduleUpdate("online");
    }

    if (!navigator.onLine) {
      scheduleUpdate("offline");
    }

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, [autoHideMs]);

  if (!visibleState) return null;

  const isOffline = visibleState === "offline";

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 top-2 z-50 flex justify-center px-4"
    >
      <div
        className={`rounded-radius-sm pointer-events-auto border px-4 py-2 text-sm font-medium shadow-sm ${
          isOffline
            ? "bg-error-bg text-error border-error-border"
            : "bg-success-bg text-success border-success-border"
        }`}
      >
        {isOffline ? "Sin conexión" : "Conectado"}
      </div>
    </div>
  );
}
