"use client";

/**
 * Hook `usePushNotifications` (KAN-257) — port a React de la porción de suscripción de
 * `initPushNotifications()`/`updatePushButton()`/el listener de `btn-push-subscribe`
 * (`matchouse/src/dashboard/app.js`, líneas 1561-1668).
 *
 * Orquesta tres piezas que viven separadas a propósito (mismo criterio que `theme.ts`/
 * `theme-context.tsx` en KAN-256): `registerServiceWorker()` (`src/service-worker/register.js`,
 * path fijado por el AC de KAN-257), la lógica pura de suscripción (`push-notifications.ts`) y el
 * estado de React de acá. Ver `docs/push-notifications-ios-workflow.md` para el flujo completo,
 * particularmente la parte específica de iOS (requiere estar corriendo como PWA instalada — si
 * no, `isPushSupported()` devuelve `false` y el status queda en `"unsupported"`, igual que en
 * desktop sin soporte).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { registerServiceWorker } from "@/service-worker/register";
import {
  fetchVapidPublicKey,
  isPushSupported,
  logPushIssue,
  PushSubscriptionError,
  sendSubscriptionToBackend,
  urlBase64ToUint8Array,
} from "./push-notifications";

export type PushNotificationStatus =
  "unsupported" | "idle" | "subscribing" | "subscribed" | "denied" | "error";

export interface UsePushNotificationsOptions {
  /** Gate: el registro del SW y el chequeo de suscripción existente solo corren mientras `true` (ej. sesión autenticada). */
  enabled: boolean;
}

export interface UsePushNotificationsResult {
  status: PushNotificationStatus;
  /** Pide permiso, se suscribe al Push Manager y avisa al backend. No-op si el SW todavía no terminó de registrarse. */
  subscribe: () => Promise<void>;
}

export function usePushNotifications({
  enabled,
}: UsePushNotificationsOptions): UsePushNotificationsResult {
  const [status, setStatus] = useState<PushNotificationStatus>("idle");
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    async function init(): Promise<void> {
      if (!isPushSupported()) {
        setStatus("unsupported");
        return;
      }

      const registration = await registerServiceWorker();
      if (cancelled) return;

      if (!registration) {
        logPushIssue("sw_registration_failed");
        setStatus("error");
        return;
      }
      registrationRef.current = registration;

      if (Notification.permission === "denied") {
        setStatus("denied");
        return;
      }

      const existing = await registration.pushManager.getSubscription();
      if (cancelled) return;
      setStatus(existing ? "subscribed" : "idle");
    }

    void init();

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  const subscribe = useCallback(async () => {
    const registration = registrationRef.current;
    if (!registration) return;

    setStatus("subscribing");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("denied");
        return;
      }

      const publicKey = await fetchVapidPublicKey();
      const subscription = await registration.pushManager
        .subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        })
        .catch((error: unknown) => {
          throw new PushSubscriptionError(
            "No se pudo suscribir al Push Manager.",
            "pushmanager_subscribe_failed",
            { cause: error },
          );
        });

      await sendSubscriptionToBackend(subscription);
      setStatus("subscribed");
    } catch (error) {
      const category =
        error instanceof PushSubscriptionError ? error.category : "pushmanager_subscribe_failed";
      logPushIssue(category, error);
      setStatus("error");
    }
  }, []);

  return { status, subscribe };
}
