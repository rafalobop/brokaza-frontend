# Checklist de QA — Service Worker + Web Push, foco iOS (KAN-257)

**Protocolo:** §10 de `matchouse/MIGRATION_PLAN.md` — _"Regresión de push/PWA en iOS: checklist
de QA específico para iOS (instalación como PWA + habilitación de push) antes de cerrar el módulo
de infraestructura transversal"_. El flujo completo (por qué cada paso existe) está documentado en
`push-notifications-ios-workflow.md` — este documento es el checklist de validación en sí.

**Alcance:** `src/service-worker/register.js`, `public/sw.js`, `src/lib/ios-onboarding.ts`,
`src/lib/push-notifications.ts`, `src/lib/use-push-notifications.ts`,
`src/components/IosInstallBanner.tsx`, `src/components/PushNotificationButton.tsx`.

## 1. Escenarios a validar (AC3 — "todos los escenarios necesarios")

| #   | Escenario                                   | Cómo verificarlo                                                                                                                           | Resultado esperado                                                                                                                                                                                 |
| --- | ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | iOS, Safari, pestaña normal (no instalado)  | Abrir el dashboard en Safari de un iPhone/iPad real, sin agregar a inicio                                                                  | Banner de "Agregar a inicio" visible; botón de push **no** se renderiza (`isPushSupported()` falso)                                                                                                |
| 2   | iOS, agregar a pantalla de inicio           | Tocar Compartir → "Agregar a inicio" desde el escenario 1                                                                                  | Ícono nuevo en la pantalla de inicio; la pestaña de Safari original no cambia de estado todavía                                                                                                    |
| 3   | iOS, abrir desde el ícono instalado         | Tocar el ícono agregado en el paso 2 (no volver a Safari)                                                                                  | Corre en modo standalone; banner desaparece; botón "Activar notificaciones" visible                                                                                                                |
| 4   | iOS, activar notificaciones                 | Tocar "Activar notificaciones" en el escenario 3 y conceder el permiso nativo                                                              | Botón pasa a "Notificaciones activas" (deshabilitado); `POST /api/notifications/subscribe` responde 200 (ver Network)                                                                              |
| 5   | iOS, rechazar el permiso nativo             | Tocar "Activar notificaciones" y tocar "No permitir" en el prompt nativo                                                                   | Botón vuelve a "Activar notificaciones" (no queda colgado en "Solicitando permiso...")                                                                                                             |
| 6   | iOS, permiso ya bloqueado de antes          | Repetir el flujo con notificaciones ya bloqueadas para el sitio (Ajustes → Notificaciones → Brokaza → Off)                                 | Botón muestra "Bloqueado", deshabilitado — no dispara un prompt nativo que iOS de todos modos no muestra                                                                                           |
| 7   | iOS, cerrar el banner                       | Tocar la ✕ del banner de onboarding sin instalar la PWA                                                                                    | Banner desaparece y no vuelve a aparecer en esa sesión ni en una recarga (persistido en `localStorage`)                                                                                            |
| 8   | iOS, banner no aparece si ya está instalado | Repetir el escenario 1 luego de ya haber instalado la PWA en otro momento (abrir por Safari de nuevo)                                      | Banner **no** aparece — `isRunningAsInstalledPwa()` no aplica a la pestaña de Safari normal, pero si el usuario ya usa la PWA instalada como su acceso habitual esto es informativo, no bloqueante |
| 9   | Push entrante con la PWA en background      | Con la PWA instalada y suscripta, generar un match nuevo que dispare un push desde el backend                                              | Notificación nativa del sistema aparece (título, cuerpo, ícono)                                                                                                                                    |
| 10  | Tocar la notificación                       | Tocar la notificación del escenario 9                                                                                                      | Foca la PWA si ya está abierta en background, o la abre si estaba cerrada; navega a la URL del `data.url` del push                                                                                 |
| 11  | Android/Chrome (control, no-iOS)            | Repetir escenarios 1-3 en Android/Chrome                                                                                                   | El botón de push se renderiza directo, sin pasar por el banner de iOS (`isIosDevice()` falso)                                                                                                      |
| 12  | Desktop (control, no soportado)             | Abrir el dashboard en un navegador sin soporte de push (o con el permiso bloqueado a nivel navegador)                                      | Igual que iOS sin instalar: sin banner (no es iOS), sin botón si no hay soporte                                                                                                                    |
| 13  | Reintento tras un error de red              | Provocar una falla de red en `GET /api/notifications/vapid-public-key` (ej. DevTools → Network → Offline) y tocar "Activar notificaciones" | Botón pasa a "Reintentar activar notificaciones" (no queda colgado); consola muestra `[PUSH] category=vapid_key_fetch_failed`                                                                      |

## 2. Matriz de versiones de iOS / navegadores (AC4)

**Estado real al cierre de este ticket: sin ejecutar.** Este entorno de desarrollo no tiene acceso
a un dispositivo iOS físico ni a un simulador de Xcode/BrowserStack — toda la validación de este
ticket fue automatizada (tests unitarios/de componente con `userAgent` simulado en jsdom, ver §3)
o de código (lectura de las 4 capas del flujo contra el legacy). **La tabla de abajo es la plantilla
que QA debe completar con dispositivos/navegadores reales antes de dar el módulo por cerrado** —
no se puede simular de forma confiable el comportamiento real de instalación de PWA + Push API de
Safari sin hardware o un simulador real (jsdom no implementa `ServiceWorker`/`PushManager`/el flujo
de "Agregar a inicio").

| iOS / navegador                                                                    | Escenarios 1-10 (§1) | Comportamiento irregular observado | Estado       |
| ---------------------------------------------------------------------------------- | -------------------- | ---------------------------------- | ------------ |
| iOS 17.x, Safari                                                                   | —                    | —                                  | ⬜ Pendiente |
| iOS 16.x, Safari                                                                   | —                    | —                                  | ⬜ Pendiente |
| iOS 15.x, Safari (mínimo soportado con Web Push, iOS 16.4+ lo requiere — ver nota) | —                    | —                                  | ⬜ Pendiente |
| iPadOS 17.x, Safari                                                                | —                    | —                                  | ⬜ Pendiente |
| iOS 17.x, Chrome para iOS (motor Safari/WebKit igual, mismas limitaciones de Push) | —                    | —                                  | ⬜ Pendiente |

**Nota:** Web Push en iOS requiere **iOS/iPadOS 16.4 o superior** (Apple lo introdujo en esa
versión). En versiones anteriores, `isPushSupported()` da `false` incluso con la PWA instalada —
comportamiento esperado, no un bug de esta implementación. Si QA prueba en una versión menor a
16.4, el resultado esperado del escenario 3 (§1) cambia: el botón sigue sin renderizarse aunque la
PWA esté instalada.

## 3. Cobertura automatizada existente (evidencia de código, no reemplaza §2)

```
__tests__/register-service-worker.test.ts     (4 tests)
__tests__/ios-onboarding.test.ts              (10 tests, incl. detección iPadOS 13+ vía MacIntel+touch)
__tests__/push-notifications.test.ts          (9 tests)
__tests__/use-push-notifications.test.tsx     (9 tests)
__tests__/ios-install-banner.test.tsx         (4 tests)
__tests__/push-notification-button.test.tsx   (4 tests)
```

Suite completa de `brokaza-frontend` (rama `feature/KAN-257`) al momento de este checklist:

```
Test Suites: 51 passed, 51 total
Tests:       326 passed, 326 total
tsc --noEmit: sin errores
eslint: sin errores
next build: OK
```

(Reproducible con `npx jest && npx tsc --noEmit && npx eslint` desde la raíz de
`brokaza-frontend`.)

## 4. Sistema de monitoreo post-lanzamiento (AC5)

Ver `push-notifications-ios-workflow.md` §4 para el detalle de las categorías
(`PushSubscriptionErrorCategory`) y sus límites actuales (client-side únicamente, sin endpoint de
backend todavía). Para el piloto post-lanzamiento, el protocolo de QA/ops es:

1. Ante un reporte de "no me llegan las notificaciones", pedir al usuario reproducir el flujo con
   la consola del navegador abierta (o revisar remotamente vía Safari Web Inspector en un Mac
   conectado, para iOS).
2. Buscar líneas `[PUSH] category=...` — la categoría indica el punto exacto de falla sin necesitar
   reproducir el flujo completo a ciegas (ver tabla de categorías en §4 del workflow).
3. Si se acumulan reportes de una categoría específica, es la señal para priorizar el ticket de
   seguimiento (endpoint de backend dedicado, mencionado como fuera de alcance en el workflow).

## 5. Fuera de alcance de este checklist

- **Ejecución real de la matriz de §2** — pendiente, requiere dispositivos/simuladores reales (ver
  nota de §2). No bloquea el sign-off de código/tests de este ticket, pero **sí bloquea considerar
  el módulo de push validado end-to-end en iOS** — mismo patrón que el hallazgo de §5.1 del
  checklist de Upload (KAN-219).
- **Retiro del código legacy** (`matchouse/src/dashboard/sw.js`, la porción de push de `app.js`,
  `ios-onboarding.js`) — Fase 5 (KAN-258), no este ticket.
- **Endpoint de backend para centralizar la categorización de errores** — ver §4 del workflow,
  recomendado como ticket de seguimiento, no parte de este ticket (Media, sin cambios de backend).

## 6. Sign-off

**Pendiente de sign-off de QA** (sesión `/qa KAN-257`) — este documento es el insumo, no el
sign-off en sí. QA debe completar la tabla de §2 con dispositivos/navegadores reales (o registrar
explícitamente la limitación de no tener acceso a hardware iOS, igual que se documenta acá) antes
de aprobar el cierre completo del módulo.
