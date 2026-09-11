/**
 * Lógica pura del socket del contador de matches en tiempo real (KAN-187).
 *
 * Port 1:1 de `src/dashboard/realtimeMatches.js` (matchouse, KAN-88) — la
 * URL del WS, la decisión de refetch por mensaje entrante y el cálculo de
 * backoff/jitter no cambian entre el dashboard legacy y `useRealtimeMatches`
 * (`use-realtime-matches.ts`), solo el runtime que las invoca.
 */

export const DEFAULT_INITIAL_DELAY_MS = 1000;
export const DEFAULT_MAX_DELAY_MS = 15000;

// Tope de intentos de reconexión consecutivos antes de desistir. El polling de respaldo
// (FALLBACK_POLL_MIN_MS/MAX_MS) ya cubre la función del WS si el servidor está caído por un
// rato largo — insistir para siempre no aporta nada y solo genera ruido/conexiones colgadas.
export const MAX_RECONNECT_ATTEMPTS = 5;

// El polling ya no es el mecanismo primario de actualización (eso lo hace el push por WS) — es la
// red de seguridad para pestañas sin WS o con el socket caído. Ver metrics.js/dashboard-metrics.ts
// para el registro de cuándo dispara con el socket arriba vs. abajo.
export const FALLBACK_POLL_MIN_MS = 15000;
export const FALLBACK_POLL_MAX_MS = 30000;

/**
 * Intervalo random dentro de [minMs, maxMs), independiente por cada
 * pestaña/recurso — evita que todas las pestañas abiertas al mismo tiempo
 * (ej. todas reconectando tras una caída del server) polleen en el mismo
 * instante exacto ("thundering herd"), sin necesidad de coordinación entre
 * clientes.
 */
export function randomIntervalMs(minMs: number, maxMs: number): number {
  return Math.floor(minMs + Math.random() * (maxMs - minMs));
}

export function buildMatchCountSocketUrl(location: Pick<Location, "protocol" | "host">): string {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${location.host}/ws`;
}

/**
 * Decide si un mensaje entrante del WS debe disparar un refetch. Nunca
 * confía en datos del payload más allá del `type` — el evento real
 * (`src/services/realtimeHub.ts` del backend) es intencionalmente liviano y
 * sin datos de negocio, así que esta función solo necesita reconocer el tipo
 * de evento, no interpretar nada más.
 */
export function shouldRefetchOnMessage(rawData: unknown): boolean {
  if (typeof rawData !== "string") return false;
  let payload: unknown;
  try {
    payload = JSON.parse(rawData);
  } catch {
    return false;
  }
  return (
    !!payload &&
    typeof payload === "object" &&
    (payload as { type?: unknown }).type === "match_count_changed"
  );
}

/**
 * Backoff exponencial acotado — cada reconexión fallida duplica la espera
 * hasta el tope, para no insistir agresivamente si el servidor está caído
 * ni tampoco tardar demasiado en recuperar el canal en vivo cuando vuelve.
 */
export function nextReconnectDelayMs(
  currentDelayMs: number,
  maxDelayMs: number = DEFAULT_MAX_DELAY_MS,
): number {
  return Math.min(currentDelayMs * 2, maxDelayMs);
}
