/**
 * Métricas de rendimiento/latencia del canal en tiempo real del dashboard
 * (WS + polling de fallback) — port 1:1 de `src/dashboard/metrics.js`
 * (matchouse, KAN-128).
 *
 * El estado se pasa explícito (no hay singleton acá) para que sea trivial
 * de testear y para que el caller (`useRealtimeMatches`, ver
 * `use-realtime-matches.ts`) decida cuándo arranca/reinicia una ventana de
 * medición. No mide latencia de red per se (el evento del servidor no lleva
 * timestamp) — mide lo que sí es 100% observable del lado del cliente:
 * cuántas veces se abrió/cerró el socket, cuántos reintentos de reconexión
 * hubo, cuánto tarda el refetch disparado por cada evento WS, y cuántas
 * veces disparó el polling de fallback (y si lo hizo con el socket arriba o
 * abajo — si dispara seguido con el socket abierto, algo anda mal con el
 * push).
 */

const MAX_SAMPLES = 50; // cota simple para no acumular memoria sin límite en una pestaña abierta muchas horas

export interface DashboardMetricsState {
  windowStartedAt: number;
  socketOpens: number;
  socketCloses: number;
  reconnectAttempts: number;
  refetchDurationsMs: number[];
  pollTicksWhileSocketUp: number;
  pollTicksWhileSocketDown: number;
}

export interface DashboardMetricsSnapshot {
  windowMs: number;
  socketOpens: number;
  socketCloses: number;
  reconnectAttempts: number;
  refetchSampleCount: number;
  avgRefetchDurationMs: number;
  p95RefetchDurationMs: number;
  pollTicksWhileSocketUp: number;
  pollTicksWhileSocketDown: number;
  timestamp: number;
}

export function createState(): DashboardMetricsState {
  return {
    windowStartedAt: Date.now(),
    socketOpens: 0,
    socketCloses: 0,
    reconnectAttempts: 0,
    refetchDurationsMs: [],
    pollTicksWhileSocketUp: 0,
    pollTicksWhileSocketDown: 0,
  };
}

export function recordSocketOpen(state: DashboardMetricsState): void {
  state.socketOpens++;
}

export function recordSocketClose(state: DashboardMetricsState): void {
  state.socketCloses++;
}

export function recordReconnectAttempt(state: DashboardMetricsState): void {
  state.reconnectAttempts++;
}

export function recordRefetchDuration(state: DashboardMetricsState, durationMs: number): void {
  if (typeof durationMs !== "number" || !isFinite(durationMs) || durationMs < 0) return;
  state.refetchDurationsMs.push(durationMs);
  if (state.refetchDurationsMs.length > MAX_SAMPLES) {
    state.refetchDurationsMs.shift();
  }
}

export function recordPollTick(state: DashboardMetricsState, isSocketConnected: boolean): void {
  if (isSocketConnected) {
    state.pollTicksWhileSocketUp++;
  } else {
    state.pollTicksWhileSocketDown++;
  }
}

// Percentil simple por interpolación del índice más cercano — alcanza para una muestra chica
// (<=50 puntos) del lado del cliente, no hace falta un algoritmo de percentiles exacto.
function percentile(sortedValues: number[], p: number): number {
  if (sortedValues.length === 0) return 0;
  const index = Math.min(sortedValues.length - 1, Math.floor((p / 100) * sortedValues.length));
  return sortedValues[index];
}

export function buildSnapshot(
  state: DashboardMetricsState,
  now: number = Date.now(),
): DashboardMetricsSnapshot {
  const durations = state.refetchDurationsMs.slice().sort((a, b) => a - b);
  const avg = durations.length
    ? durations.reduce((sum, v) => sum + v, 0) / durations.length
    : 0;

  return {
    windowMs: now - state.windowStartedAt,
    socketOpens: state.socketOpens,
    socketCloses: state.socketCloses,
    reconnectAttempts: state.reconnectAttempts,
    refetchSampleCount: durations.length,
    avgRefetchDurationMs: Math.round(avg),
    p95RefetchDurationMs: Math.round(percentile(durations, 95)),
    pollTicksWhileSocketUp: state.pollTicksWhileSocketUp,
    pollTicksWhileSocketDown: state.pollTicksWhileSocketDown,
    timestamp: now,
  };
}

/**
 * Arranca una ventana nueva conservando el mismo objeto de estado (para no
 * perder la referencia que ya tiene el caller) — se llama después de mandar
 * un snapshot al backend.
 */
export function resetWindow(state: DashboardMetricsState, now: number = Date.now()): void {
  state.windowStartedAt = now;
  state.socketOpens = 0;
  state.socketCloses = 0;
  state.reconnectAttempts = 0;
  state.refetchDurationsMs = [];
  state.pollTicksWhileSocketUp = 0;
  state.pollTicksWhileSocketDown = 0;
}
