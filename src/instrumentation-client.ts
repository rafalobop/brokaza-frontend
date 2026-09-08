/**
 * Init de Sentry en el browser (KAN-322). Convención de Next.js (ver
 * `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/instrumentation-client.md`):
 * corre antes de la hidratación de React, ideal para instalar error tracking temprano.
 *
 * `Sentry.init` instala por default la integración `GlobalHandlers`, que cubre `window.onerror`
 * (errores no capturados) y `unhandledrejection` (promesas rechazadas sin catch) — es lo que pide
 * el AC de "capturas globales", sin código adicional de nuestra parte.
 */
import * as Sentry from "@sentry/nextjs";
import { SENTRY_DSN, SENTRY_ENABLED, SENTRY_ENVIRONMENT, SENTRY_IGNORE_ERRORS, SENTRY_TRACES_SAMPLE_RATE } from "@/lib/sentry-shared";

Sentry.init({
  dsn: SENTRY_DSN,
  enabled: SENTRY_ENABLED,
  environment: SENTRY_ENVIRONMENT,
  tracesSampleRate: SENTRY_TRACES_SAMPLE_RATE,
  ignoreErrors: SENTRY_IGNORE_ERRORS,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
