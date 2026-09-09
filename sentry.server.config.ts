/** Init de Sentry para el runtime Node.js del server (KAN-322). Cargado desde `instrumentation.ts`. */
import * as Sentry from "@sentry/nextjs";
import {
  SENTRY_DSN,
  SENTRY_ENABLED,
  SENTRY_ENVIRONMENT,
  SENTRY_IGNORE_ERRORS,
  SENTRY_TRACES_SAMPLE_RATE,
} from "@/lib/sentry-shared";

Sentry.init({
  dsn: SENTRY_DSN,
  enabled: SENTRY_ENABLED,
  environment: SENTRY_ENVIRONMENT,
  tracesSampleRate: SENTRY_TRACES_SAMPLE_RATE,
  ignoreErrors: SENTRY_IGNORE_ERRORS,
});
