"use client";

/**
 * Botón de suscripción a Web Push (KAN-257) — port del `btn-push-subscribe`
 * (`matchouse/src/dashboard/app.js`, líneas 1561-1668). No se renderiza si el navegador no
 * soporta push (`status === "unsupported"`) — mismo criterio que el legacy, que mantenía el botón
 * oculto (`classList.add('hidden')`) hasta confirmar soporte.
 *
 * Ícono-solo (campanita) en vez del pill de texto original — vive en la topbar, donde el resto de
 * las acciones (perfil, hamburguesa) también son íconos. El label sigue existiendo como
 * `aria-label`/`title`, no se pierde para lectores de pantalla ni al pasar el mouse.
 *
 * Toggle real: en `subscribed`, el click llama a `unsubscribe()` (cancela la suscripción en el
 * browser) en vez de quedar deshabilitado. `denied` sigue sin acción — ningún sitio puede revertir
 * un permiso de notificaciones ya denegado por el usuario, solo se explica cómo desbloquearlo.
 */

import { Bell, BellOff, BellRing } from "lucide-react";
import { usePushNotifications, type PushNotificationStatus } from "@/lib/use-push-notifications";

const LABELS: Record<Exclude<PushNotificationStatus, "unsupported">, string> = {
  idle: "Activar notificaciones",
  subscribing: "Solicitando permiso...",
  subscribed: "Notificaciones activas",
  denied: "Bloqueado",
  error: "Reintentar activar notificaciones",
};

const TITLES: Record<Exclude<PushNotificationStatus, "unsupported">, string> = {
  ...LABELS,
  subscribed: "Notificaciones activas — click para desactivar",
  denied: "Bloqueado — habilitalo desde la configuración de notificaciones del navegador",
};

const ICONS: Record<Exclude<PushNotificationStatus, "unsupported">, typeof Bell> = {
  idle: Bell,
  subscribing: Bell,
  subscribed: BellRing,
  denied: BellOff,
  error: Bell,
};

export function PushNotificationButton({ enabled }: { enabled: boolean }) {
  const { status, subscribe, unsubscribe } = usePushNotifications({ enabled });

  if (status === "unsupported") return null;

  const disabled = status === "subscribing" || status === "denied";
  const Icon = ICONS[status];

  function handleClick() {
    if (status === "subscribed") {
      void unsubscribe();
      return;
    }
    void subscribe();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      aria-label={LABELS[status]}
      aria-pressed={status === "subscribed"}
      title={TITLES[status]}
      className={`rounded-full p-2 transition disabled:cursor-default ${
        status === "subscribed" ? "text-accent" : "text-text-secondary hover:bg-card"
      }`}
    >
      <Icon className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}
