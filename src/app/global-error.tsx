"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// KAN-322: `global-error` cubre errores del root layout (fuera del boundary de `error.tsx`,
// ver `error.md#global-error`) — sin esto, un crash ahí quedaba solo en la consola del navegador,
// nunca llegaba a Sentry.
export default function GlobalError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="es">
      <body>
        <h2>Algo salió mal.</h2>
        <button onClick={() => retry()}>Reintentar</button>
      </body>
    </html>
  );
}
