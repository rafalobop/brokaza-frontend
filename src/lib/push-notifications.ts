/**
 * Lógica pura de Web Push (KAN-257) — port de la porción de suscripción de
 * `initPushNotifications()`/`updatePushButton()` (`matchouse/src/dashboard/app.js`, líneas
 * 1585-1668) — todo lo que no es DOM manual ni estado de React, para poder testear sin mocks de
 * componente. El registro del Service Worker en sí vive aparte, en
 * `src/service-worker/register.js` (pedido explícito del AC de KAN-257).
 *
 * `PushSubscriptionErrorCategory` es la base del "sistema de monitoreo post-lanzamiento para
 * categorizar problemas" que pide el AC: cada punto de falla del flujo (no soportado, permiso
 * denegado, falla de red al pedir la VAPID key, falla de `pushManager.subscribe`, falla al avisar
 * al backend) queda taggeado con una categoría fija en vez de un mensaje de error libre — ver
 * `docs/push-notifications-ios-workflow.md` §4 para el detalle de por qué esto es client-side
 * únicamente por ahora (no hay endpoint de backend para telemetría de push todavía).
 */

import { apiClient } from "./api-client";

export type PushSubscriptionErrorCategory =
  | "unsupported"
  | "permission_denied"
  | "sw_registration_failed"
  | "vapid_key_fetch_failed"
  | "pushmanager_subscribe_failed"
  | "backend_subscribe_failed"
  | "pushmanager_unsubscribe_failed";

export class PushSubscriptionError extends Error {
  readonly category: PushSubscriptionErrorCategory;

  constructor(
    message: string,
    category: PushSubscriptionErrorCategory,
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.name = "PushSubscriptionError";
    this.category = category;
  }
}

/** `true` si el navegador soporta Service Worker + Push API. En iOS Safari, solo dentro de una PWA instalada (ver `ios-onboarding.ts`). */
export function isPushSupported(): boolean {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false;
  return "serviceWorker" in navigator && "PushManager" in window;
}

/** Convierte la clave pública VAPID (base64url) al formato que espera `pushManager.subscribe`. */
export function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(new ArrayBuffer(rawData.length));
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

interface VapidKeyResponse {
  publicKey: string;
}

/** Trae la clave pública VAPID del backend. Lanza `PushSubscriptionError` (`vapid_key_fetch_failed`) si falla. */
export async function fetchVapidPublicKey(): Promise<string> {
  try {
    const { publicKey } = await apiClient<VapidKeyResponse>("/api/notifications/vapid-public-key");
    return publicKey;
  } catch (error) {
    throw new PushSubscriptionError(
      "No se pudo obtener la clave pública VAPID del servidor.",
      "vapid_key_fetch_failed",
      { cause: error },
    );
  }
}

/** Avisa al backend de una suscripción nueva. Lanza `PushSubscriptionError` (`backend_subscribe_failed`) si falla. */
export async function sendSubscriptionToBackend(subscription: PushSubscription): Promise<void> {
  try {
    await apiClient("/api/notifications/subscribe", {
      method: "POST",
      body: JSON.stringify({ subscription }),
    });
  } catch (error) {
    throw new PushSubscriptionError(
      "No se pudo registrar la suscripción en el servidor.",
      "backend_subscribe_failed",
      { cause: error },
    );
  }
}

/**
 * Log estructurado de un problema de push, categorizado (ver header del archivo). Único punto de
 * salida para que QA/ops puedan filtrar por `[PUSH]` + categoría en la consola/logs del navegador
 * durante el piloto, sin depender de un endpoint de backend que todavía no existe.
 */
export function logPushIssue(category: PushSubscriptionErrorCategory, error?: unknown): void {
  console.error(`[PUSH] category=${category}`, error);
}
