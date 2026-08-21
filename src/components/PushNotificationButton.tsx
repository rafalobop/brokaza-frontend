"use client";

/**
 * Botón de suscripción a Web Push (KAN-257) — port del `btn-push-subscribe`
 * (`matchouse/src/dashboard/app.js`, líneas 1561-1668). No se renderiza si el navegador no
 * soporta push (`status === "unsupported"`) — mismo criterio que el legacy, que mantenía el botón
 * oculto (`classList.add('hidden')`) hasta confirmar soporte.
 */

import { usePushNotifications, type PushNotificationStatus } from "@/lib/use-push-notifications";

const LABELS: Record<Exclude<PushNotificationStatus, "unsupported">, string> = {
  idle: "Activar notificaciones",
  subscribing: "Solicitando permiso...",
  subscribed: "Notificaciones activas",
  denied: "Bloqueado",
  error: "Reintentar activar notificaciones",
};

export function PushNotificationButton({ enabled }: { enabled: boolean }) {
  const { status, subscribe } = usePushNotifications({ enabled });

  if (status === "unsupported") return null;

  const disabled = status === "subscribing" || status === "subscribed" || status === "denied";

  return (
    <button
      type="button"
      onClick={() => void subscribe()}
      disabled={disabled}
      className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 transition disabled:opacity-70 dark:border-zinc-700 dark:text-zinc-200"
    >
      {LABELS[status]}
    </button>
  );
}
