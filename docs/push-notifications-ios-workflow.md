# Web Push + flujo específico de iOS (KAN-257)

**Protocolo:** §10 de `matchouse/MIGRATION_PLAN.md` — _"Regresión de push/PWA en iOS: checklist
de QA específico para iOS (instalación como PWA + habilitación de push) antes de cerrar el módulo
de infraestructura transversal"_. Este documento es el flujo (el AC pide que esté "claramente
documentado"); el checklist en sí vive en `push-notifications-ios-qa-checklist.md`.

**Alcance:** módulo Service Worker + Web Push completo — port 1:1 de
`matchouse/src/dashboard/app.js` (líneas 1526-1668, push notifications + onboarding iOS),
`matchouse/src/dashboard/sw.js` (el Service Worker) e `matchouse/src/dashboard/ios-onboarding.js`
(KAN-47) a `brokaza-frontend`.

## 1. Por qué iOS es un caso especial

Safari en iOS/iPadOS solo expone la Push API (`PushManager`) a una PWA **instalada** (agregada a
la pantalla de inicio vía "Compartir → Agregar a inicio") — nunca a una pestaña normal de Safari,
sin importar si el usuario dio permiso de notificaciones al sitio. Fuera de una instalación así,
`'PushManager' in window` es `false` — no hay error, no hay excepción, simplemente el feature no
existe en ese contexto.

Esto tiene una consecuencia silenciosa para la UX: si un usuario de iOS toca "Activar
notificaciones" en una pestaña normal, no pasa nada — ni un mensaje de error, ni el permiso nativo
del navegador. El botón ni siquiera se muestra (`isPushSupported()` en
`src/lib/push-notifications.ts` corta antes), así que sin ningún aviso previo el usuario nunca
entiende por qué "no hay botón".

## 2. Piezas del flujo y dónde viven

| Pieza                           | Archivo                                     | Responsabilidad                                                                                                                                                         |
| ------------------------------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Registro del SW                 | `src/service-worker/register.js`            | `registerServiceWorker()` — un único guard clause de soporte, sin lógica condicional extra (AC de KAN-257).                                                             |
| El Service Worker en sí         | `public/sw.js`                              | Listener `push` (arma y muestra la notificación) + `notificationclick` (foca la pestaña existente o abre una nueva). Estático, nunca pasa por el bundler de Next.js.    |
| Detección de "iOS sin instalar" | `src/lib/ios-onboarding.ts`                 | `isIosDevice`/`isRunningAsInstalledPwa`/`shouldShowIosInstallOnboarding` — puras, testeadas sin DOM real.                                                               |
| Lógica de suscripción           | `src/lib/push-notifications.ts`             | `isPushSupported`, conversión de la VAPID key, fetch de la key pública, aviso al backend — cada punto de falla categorizado (ver §4).                                   |
| Orquestación de React           | `src/lib/use-push-notifications.ts`         | Hook `usePushNotifications({ enabled })` — registra el SW al habilitarse, expone `status` y `subscribe()`.                                                              |
| Banner de onboarding            | `src/components/IosInstallBanner.tsx`       | Se muestra en iOS fuera de una PWA instalada, ANTES de que el usuario intente activar push. Dismissible, recordado en `localStorage` (`brokaza-ios-install-dismissed`). |
| Botón de suscripción            | `src/components/PushNotificationButton.tsx` | No se renderiza si `status === "unsupported"` — mismo criterio que el legacy (`btnPushSubscribe` oculto hasta confirmar soporte).                                       |

## 3. El flujo paso a paso en iOS

1. **Usuario entra al dashboard en Safari (iOS), sin instalar como PWA.**
   `IosInstallBanner` detecta `isIosDevice() && !isRunningAsInstalledPwa()` → muestra el aviso
   "agregá Brokaza a tu pantalla de inicio". `PushNotificationButton` no se renderiza (`status`
   queda en `"unsupported"` tras el primer render del hook, porque `isPushSupported()` es `false`
   sin importar cuánto tiempo pase — no hay forma de "esperar" a que aparezca).
2. **Usuario toca el ícono de compartir → "Agregar a inicio".** iOS crea un ícono en la pantalla
   de inicio. La pestaña de Safari actual sigue siendo una pestaña normal — nada cambia todavía en
   esta sesión.
3. **Usuario abre la app desde el ícono de la pantalla de inicio (no desde Safari).** Ahora corre
   en modo standalone: `navigator.standalone === true` (o `matchMedia('(display-mode: standalone)')`
   matchea). `isRunningAsInstalledPwa()` pasa a `true` → el banner deja de mostrarse (aunque el
   usuario nunca lo haya cerrado a mano) y `isPushSupported()` pasa a `true`.
4. **`usePushNotifications` registra el Service Worker** (`registerServiceWorker()` →
   `navigator.serviceWorker.register('/sw.js')`) y consulta si ya había una suscripción
   (`pushManager.getSubscription()`). Sin suscripción previa y sin permiso denegado, `status` queda
   en `"idle"` → `PushNotificationButton` se renderiza con "Activar notificaciones".
5. **Usuario toca "Activar notificaciones".** `subscribe()`: pide permiso nativo
   (`Notification.requestPermission()`) → si se concede, trae la VAPID key pública
   (`GET /api/notifications/vapid-public-key`) → `pushManager.subscribe(...)` → avisa al backend
   (`POST /api/notifications/subscribe`). Cualquier falla en estos pasos queda categorizada (§4) en
   vez de un error genérico.
6. **Push entrante:** el backend (`matchouse/src/services/webPush.ts`) manda el push vía Web Push
   estándar; `public/sw.js` lo recibe en el listener `push`, arma la notificación nativa y la
   muestra. Al tocarla, `notificationclick` foca la pestaña de la PWA si ya está abierta, o la abre
   si no.

**Timing bajo Next.js vs. el legacy (riesgo señalado en §6/§10 de `MIGRATION_PLAN.md`):** el
legacy registraba el SW como parte de un script clásico que corría una sola vez al cargar
`index.html`, después de resolver la sesión (`checkAuthSession().then(() => { ...
initPushNotifications(); })`). Acá el registro corre dentro de un `useEffect` gateado por
`enabled` (`status === "authenticated"` en `app/page.tsx`) — se re-evalúa cada vez que cambia el
estado de auth, no una única vez al cargar la página. Comportamiento verificado con
`use-push-notifications.test.tsx` (los casos de `enabled` false/true) — no hay doble registro ni
memory leak de listeners entre renders, mismo criterio que ya se validó para el hook de WS en
KAN-187.

## 4. Sistema de categorización de problemas (AC5)

Cada punto de falla del flujo de suscripción queda taggeado con una categoría fija
(`PushSubscriptionErrorCategory` en `src/lib/push-notifications.ts`), no un mensaje libre:

| Categoría                                    | Punto de falla                                                                                                                                          |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `unsupported`                                | Navegador sin `serviceWorker`/`PushManager` (ej. iOS fuera de una PWA instalada). No es un "error" — es un estado esperado, no pasa por `logPushIssue`. |
| `sw_registration_failed`                     | `navigator.serviceWorker.register('/sw.js')` tira.                                                                                                      |
| `permission_denied` (vía `status: "denied"`) | El usuario rechaza el permiso nativo, o ya estaba bloqueado de antes.                                                                                   |
| `vapid_key_fetch_failed`                     | `GET /api/notifications/vapid-public-key` falla (red, 401, 500).                                                                                        |
| `pushmanager_subscribe_failed`               | `pushManager.subscribe(...)` tira (ej. clave VAPID inválida, usuario cerró el prompt nativo).                                                           |
| `backend_subscribe_failed`                   | `POST /api/notifications/subscribe` falla — la suscripción del browser existe pero el backend no la tiene, así que nunca va a recibir push.             |

`logPushIssue(category, error)` (`push-notifications.ts`) es el único punto de salida — loguea
`[PUSH] category=<categoría> <error>` a la consola del navegador. **Es un sistema client-side
únicamente por ahora** (Fase 1): no hay un endpoint de backend equivalente a
`POST /api/dashboard-metrics` (KAN-128/KAN-256) que centralice esto en los logs estructurados de
Pino/Railway. Durante el piloto, QA/ops puede:

- Revisar la consola del navegador de un usuario reportando el problema (filtrando por `[PUSH]`).
- Si el dashboard corre con DevTools remotos (Safari en iOS vía Mac, `chrome://inspect` en
  Android), las categorías dan un diagnóstico inmediato sin tener que reproducir el flujo completo
  a ciegas.

**Fuera de alcance de este ticket (Media, sin gate de mini-diseño):** un endpoint de backend
dedicado (`POST /api/push-issues` o similar) que centralice estas categorías en los logs del
servidor, igual que ya existe para las métricas de WS/polling del dashboard. Recomendado como
ticket de seguimiento si el volumen de reportes de "no me llegan las notificaciones" lo justifica
después del piloto.

## 5. Diferencias deliberadas vs. el legacy

- **Separación de responsabilidades:** el legacy tenía todo (registro del SW, permiso, VAPID,
  suscripción, UI del botón) en un único bloque de `app.js`. Acá está partido en 4 capas (SW
  registration / lógica pura / hook de React / componentes) — mismo criterio que KAN-256
  (tema)/KAN-187 (WS) para este repo.
- **Categorización de errores (§4)** — no existía en el legacy (`console.error` genérico sin tags).
- **`registerServiceWorker()` no depende de estado de auth** — a diferencia del legacy que
  registraba el SW incondicionalmente al cargar la página (independiente de sesión) y solo
  mostraba el botón si `isUserAuthenticated`, acá el registro completo (incluido
  `navigator.serviceWorker.register`) queda gateado por `enabled` (auth). Decisión deliberada: no
  tiene sentido registrar el SW ni consultar suscripciones para una sesión anónima que todavía no
  tiene `tenantId` para asociar la suscripción en el backend.
