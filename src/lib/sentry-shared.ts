/**
 * Config compartida entre `instrumentation-client.ts` (browser), `sentry.server.config.ts` y
 * `sentry.edge.config.ts` (KAN-322). Centraliza el "criterio claro de qué errores reportar" que
 * pide el AC:
 *
 * - Sin `NEXT_PUBLIC_SENTRY_DSN`/`SENTRY_DSN` seteado, Sentry queda deshabilitado (no rompe dev
 *   local ni CI sin credenciales) — `Sentry.init` con `dsn: undefined` es un no-op documentado.
 * - Solo reporta en `production` (`SENTRY_ENVIRONMENT`, default derivado de `NODE_ENV`): en dev,
 *   la consola del navegador/servidor ya alcanza.
 * - `ignoreErrors`: ruido conocido sin valor de diagnóstico (extensiones de browser, abort de
 *   fetch por navegación) — evita gastar la cuota de eventos del plan gratuito en algo no
 *   accionable, no oculta errores reales de la app.
 */

export const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;

export const SENTRY_ENVIRONMENT =
  process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "development";

/** Solo se reporta en producción — ver header del archivo. */
export const SENTRY_ENABLED = Boolean(SENTRY_DSN) && SENTRY_ENVIRONMENT === "production";

/**
 * Errores conocidos sin valor de diagnóstico. No es "ocultar errores": son fallos que no
 * dependen del código de Brokaza (extensiones del navegador, o un `fetch` abortado porque el
 * usuario navegó a otra pantalla mientras la request seguía en vuelo — `apiClient` ya lo
 * distingue como `kind: "timeout"`/abort, no es un bug de red real).
 */
export const SENTRY_IGNORE_ERRORS = [
  "ResizeObserver loop limit exceeded",
  "Non-Error promise rejection captured",
  /^AbortError/,
  /extensions\//i,
  /^chrome-extension:\/\//i,
  /^moz-extension:\/\//i,
];

/** Sample rate de trazas de performance. Bajo a propósito: el objetivo del ticket es error monitoring, no APM. */
export const SENTRY_TRACES_SAMPLE_RATE = 0.1;
