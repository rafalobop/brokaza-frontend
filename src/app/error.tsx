"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// KAN-322: boundary de errores de todo el árbol bajo el root layout (dashboard + admin).
// `global-error.tsx` cubre el caso — mucho más raro — de que el root layout mismo falle.
export default function Error({
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
