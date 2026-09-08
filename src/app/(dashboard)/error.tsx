"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// KAN-323: boundary scoped al segmento `(dashboard)` — a diferencia del `error.tsx` raíz
// (KAN-322), este solo reemplaza el contenido de la página; `DashboardShell` (sidebar/topbar)
// sigue montado porque vive en `(dashboard)/layout.tsx`, por encima de este boundary.
export default function DashboardError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, { tags: { errorBoundary: "dashboard" } });
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-lg font-semibold">Algo salió mal.</h2>
      <button
        onClick={() => retry()}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white dark:bg-neutral-100 dark:text-neutral-900"
      >
        Reintentar
      </button>
    </div>
  );
}
