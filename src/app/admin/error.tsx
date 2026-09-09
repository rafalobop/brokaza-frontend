"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// KAN-323: boundary scoped al segmento `/admin` — mismo criterio que `(dashboard)/error.tsx`:
// `DashboardShell` (sidebar/topbar de admin) sigue montado porque vive en `admin/layout.tsx`,
// por encima de este boundary, así que solo se pierde el contenido de la página con el error.
export default function AdminError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, { tags: { errorBoundary: "admin" } });
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
