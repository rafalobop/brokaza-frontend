/**
 * Registro del Service Worker de Web Push (KAN-257) — port de la porción de registro de
 * `initPushNotifications()` en `matchouse/src/dashboard/app.js` (líneas 1565-1583).
 *
 * Separado a propósito de la lógica de suscripción (pedir permiso, traer la VAPID key,
 * `pushManager.subscribe`, avisar al backend) — eso vive en `src/lib/push-notifications.ts` y en
 * el hook que lo consume (`use-push-notifications.ts`). Este módulo tiene una única
 * responsabilidad — registrar el SW — y por eso el AC de KAN-257 pide que "minimice la lógica
 * condicional": un solo guard clause de soporte, sin ramas anidadas.
 *
 * `.js` (no `.ts`) a propósito: el AC de KAN-257 fija este path exacto
 * (`src/service-worker/register.js`). `allowJs` ya está habilitado en `tsconfig.json`, así que
 * convive sin problema con el resto del proyecto en TypeScript.
 */

export async function registerServiceWorker(swUrl = "/sw.js") {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;

  try {
    return await navigator.serviceWorker.register(swUrl);
  } catch (error) {
    console.error("[SW] No se pudo registrar el Service Worker:", error);
    return null;
  }
}
