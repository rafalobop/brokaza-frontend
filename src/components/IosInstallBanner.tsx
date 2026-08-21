"use client";

/**
 * Banner de onboarding iOS (KAN-257) — port de `initIosInstallOnboarding()`
 * (`matchouse/src/dashboard/app.js`, líneas 1537-1555). Se muestra ANTES de que el usuario llegue
 * a pedir permiso de push, para explicar el paso previo que iOS Safari exige (agregar la app a la
 * pantalla de inicio) — sin esto, tocar "Activar notificaciones" en iOS sin instalar como PWA no
 * hace nada visible (`isPushSupported()` corta en silencio). Ver
 * `docs/push-notifications-ios-workflow.md`.
 *
 * El chequeo de plataforma (`shouldShowIosInstallOnboarding`) depende de `navigator`/`window`, así
 * que corre en un `useEffect` (no en el render inicial) para no arriesgar un mismatch de
 * hidratación — el banner puede aparecer un frame después del mount, que es aceptable acá (no es
 * un caso de FOUC como el de KAN-256).
 */

import { useEffect, useState } from "react";
import { shouldShowIosInstallOnboarding } from "@/lib/ios-onboarding";

const DISMISS_KEY = "brokaza-ios-install-dismissed";

export function IosInstallBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // `setVisible` se difiere a un microtask (no llama directo en el cuerpo del efecto) para
    // cumplir con `react-hooks/set-state-in-effect` — mismo criterio que el `void init()`
    // asincrónico de `use-push-notifications.ts`.
    void Promise.resolve().then(() => {
      if (!shouldShowIosInstallOnboarding()) return;
      if (window.localStorage.getItem(DISMISS_KEY) === "true") return;
      setVisible(true);
    });
  }, []);

  function dismiss(): void {
    setVisible(false);
    window.localStorage.setItem(DISMISS_KEY, "true");
  }

  if (!visible) return null;

  return (
    <div className="flex w-full items-start justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
      <p>
        Para recibir notificaciones en este iPhone/iPad, agregá Brokaza a tu pantalla de inicio
        primero: tocá el ícono de compartir de Safari y elegí{" "}
        <strong>&quot;Agregar a inicio&quot;</strong>.
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Cerrar aviso"
        className="shrink-0 text-amber-700 hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-200"
      >
        ✕
      </button>
    </div>
  );
}
