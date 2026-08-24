/**
 * Detección de "usuario activo" (KAN-256), usada por `useRealtimeMatches` para no reportar
 * telemetría (`POST /api/dashboard-metrics`) de una pestaña abierta pero abandonada — evita
 * ruido en el servidor sin sumar un límite server-side nuevo (ya existe el rate limiter de
 * `system.ts`, esto reduce el volumen que llega a pegarle).
 *
 * "Activo" = la pestaña está en foreground (`visibilityState`) Y hubo interacción del usuario
 * en los últimos `idleThresholdMs`. Las métricas de la ventana NO se pierden mientras está
 * inactivo — `useRealtimeMatches` sigue acumulando y solo se salta el envío, así que al volver
 * a estar activo el próximo tick manda el snapshot acumulado completo.
 */

const DEFAULT_IDLE_THRESHOLD_MS = 5 * 60 * 1000;

const ACTIVITY_EVENTS = ["mousemove", "keydown", "click", "scroll", "touchstart"] as const;

export interface ActivityTracker {
  isActive(): boolean;
  destroy(): void;
}

export function createActivityTracker(
  idleThresholdMs: number = DEFAULT_IDLE_THRESHOLD_MS,
): ActivityTracker {
  let lastActivityAt = Date.now();

  function markActive(): void {
    lastActivityAt = Date.now();
  }

  if (typeof window !== "undefined") {
    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, markActive, { passive: true }),
    );
  }

  function isActive(): boolean {
    if (typeof document !== "undefined" && document.visibilityState === "hidden") return false;
    return Date.now() - lastActivityAt < idleThresholdMs;
  }

  function destroy(): void {
    if (typeof window === "undefined") return;
    ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, markActive));
  }

  return { isActive, destroy };
}
