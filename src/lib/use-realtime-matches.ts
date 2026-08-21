"use client";

/**
 * Hook `useRealtimeMatches` (KAN-187) — port del contador de matches en
 * tiempo real de `src/dashboard/app.js` (matchouse, KAN-88/KAN-128) a React.
 *
 * La lógica pura (URL del WS, decisión de refetch, backoff, jitter) vive en
 * `realtime-matches.ts` y las métricas en `dashboard-metrics.ts` — ambos
 * ports 1:1 del legacy, sin cambios de comportamiento. Este hook es el único
 * componente nuevo: reemplaza las variables globales y los `setInterval`
 * sueltos de `app.js` por un `useEffect` con cleanup, y el
 * `fetchWithTimeout` legacy por `apiClient` (KAN-155).
 *
 * Diferencia deliberada con el legacy: `app.js` corría 4 intervalos de
 * polling independientes, uno por recurso (`loadMatches`, `loadCatalogInfo`,
 * `loadActiveSearches`, `loadIncomingMatches`), cada uno con su propio
 * jitter. Este hook no conoce esos endpoints — todavía no existen como
 * componentes React (esa es la UI de Matches, KAN-188/189/190/191, de
 * complejidad Alta y con mini-diseño propio) — así que expone un único
 * `onRefetch` que el consumidor decide cómo resolver (puede disparar varios
 * fetches en paralelo, igual que antes). El WS sigue siendo un disparador de
 * refetch, nunca una fuente de datos: si se cae, el polling de respaldo
 * sigue funcionando igual.
 */

import { useEffect, useRef } from "react";
import { apiClient } from "./api-client";
import {
  buildMatchCountSocketUrl,
  DEFAULT_INITIAL_DELAY_MS,
  FALLBACK_POLL_MAX_MS,
  FALLBACK_POLL_MIN_MS,
  nextReconnectDelayMs,
  randomIntervalMs,
  shouldRefetchOnMessage,
} from "./realtime-matches";
import {
  buildSnapshot,
  createState,
  recordPollTick,
  recordReconnectAttempt,
  recordRefetchDuration,
  recordSocketClose,
  recordSocketOpen,
  resetWindow,
} from "./dashboard-metrics";
import { createActivityTracker } from "./user-activity";

const METRICS_REPORT_INTERVAL_MS = 60000;

export interface UseRealtimeMatchesOptions {
  /** Gate: el socket y el polling solo corren mientras `true` (ej. sesión autenticada). */
  enabled: boolean;
  /**
   * Se invoca ante cada tick del polling de respaldo y ante cada push del WS
   * (`match_count_changed`). Puede devolver una promesa — se usa para medir
   * la duración del refetch disparado por el WS (ver `dashboard-metrics.ts`).
   */
  onRefetch: () => Promise<unknown> | void;
}

export function useRealtimeMatches({ enabled, onRefetch }: UseRealtimeMatchesOptions): void {
  // El callback puede recrearse en cada render del consumidor sin que eso
  // deba reconectar el socket — solo `enabled` reinicia el efecto.
  const onRefetchRef = useRef(onRefetch);
  useEffect(() => {
    onRefetchRef.current = onRefetch;
  }, [onRefetch]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const metricsState = createState();
    const activityTracker = createActivityTracker();
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectDelayMs = DEFAULT_INITIAL_DELAY_MS;
    let shouldReconnect = false;

    function isSocketOpen(): boolean {
      return !!socket && socket.readyState === WebSocket.OPEN;
    }

    function connect(): void {
      if (
        socket &&
        (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)
      ) {
        return;
      }

      shouldReconnect = true;

      const ws = new WebSocket(buildMatchCountSocketUrl(window.location));
      socket = ws;

      ws.addEventListener("open", () => {
        reconnectDelayMs = DEFAULT_INITIAL_DELAY_MS; // reset del backoff tras una conexión exitosa
        recordSocketOpen(metricsState);
      });

      ws.addEventListener("message", (event) => {
        if (!shouldRefetchOnMessage(event.data)) return;

        const startedAt = performance.now();
        Promise.resolve(onRefetchRef.current()).finally(() => {
          recordRefetchDuration(metricsState, performance.now() - startedAt);
        });
      });

      ws.addEventListener("close", () => {
        if (socket === ws) socket = null;
        recordSocketClose(metricsState);
        scheduleReconnect();
      });

      ws.addEventListener("error", (error) => {
        console.error("[REALTIME] Error en el socket del contador de matches:", error);
      });
    }

    function scheduleReconnect(): void {
      if (!shouldReconnect || reconnectTimer) return;

      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        if (shouldReconnect) {
          recordReconnectAttempt(metricsState);
          connect();
        }
      }, reconnectDelayMs);

      reconnectDelayMs = nextReconnectDelayMs(reconnectDelayMs);
    }

    function disconnect(): void {
      shouldReconnect = false;

      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }

      reconnectDelayMs = DEFAULT_INITIAL_DELAY_MS;

      if (socket) {
        socket.close();
        socket = null;
      }
    }

    async function reportMetrics(): Promise<void> {
      // Pestaña inactiva (backgrounded o sin interacción reciente): no se envía nada este
      // tick, pero tampoco se resetea la ventana — lo acumulado se manda en el próximo tick
      // en que el usuario vuelva a estar activo, no se pierde.
      if (!activityTracker.isActive()) return;

      const snapshot = buildSnapshot(metricsState);
      resetWindow(metricsState);
      try {
        await apiClient("/api/dashboard-metrics", {
          method: "POST",
          body: JSON.stringify(snapshot),
          timeoutMs: 5000,
          logTag: "[METRICS]",
        });
      } catch (error) {
        // No es crítico: si un reporte de métricas se pierde, el próximo (60s después) lo compensa.
        console.error(
          "[METRICS] No se pudo reportar el snapshot de métricas del dashboard:",
          error instanceof Error ? error.message : error,
        );
      }
    }

    const pollInterval = setInterval(
      () => {
        recordPollTick(metricsState, isSocketOpen());
        void onRefetchRef.current();
      },
      randomIntervalMs(FALLBACK_POLL_MIN_MS, FALLBACK_POLL_MAX_MS),
    );
    const metricsInterval = setInterval(reportMetrics, METRICS_REPORT_INTERVAL_MS);

    connect();

    return () => {
      clearInterval(pollInterval);
      clearInterval(metricsInterval);
      activityTracker.destroy();
      disconnect();
    };
  }, [enabled]);
}
