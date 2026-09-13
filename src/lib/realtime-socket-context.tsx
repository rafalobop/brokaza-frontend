"use client";

/**
 * `RealtimeSocketProvider` — dueño único de la conexión WebSocket a `/ws` para todo el dashboard.
 *
 * Antes de esto, `useRealtimeMatches` (contador de matches, KAN-187) y `useUpload` (barra de
 * progreso/resultado de la subida de Excel, KAN-218/338) abrían cada uno su propio `new
 * WebSocket(buildMatchCountSocketUrl(...))` contra el mismo endpoint `/ws` — durante una subida,
 * la pestaña sostenía 2 conexiones idénticas en simultáneo (cada una con su propio
 * handshake/reconnect), porque `MatchesProvider` ya mantiene la suya montada en todo el dashboard
 * mientras dura la sesión. Este módulo multiplexa un único socket compartido por `type` de
 * mensaje: cada consumidor se suscribe a los mensajes/cierres que le interesan y decide qué hacer
 * con ellos, pero solo existe una conexión real. La lógica de conexión/reconexión/backoff es el
 * mismo port 1:1 del legacy que ya tenía `useRealtimeMatches` (ver `realtime-matches.ts`), solo
 * que ahora vive acá en vez de duplicarse por consumidor.
 */

import { createContext, useContext, useEffect, useMemo, useRef, type ReactNode } from "react";
import {
  buildMatchCountSocketUrl,
  DEFAULT_INITIAL_DELAY_MS,
  MAX_RECONNECT_ATTEMPTS,
  nextReconnectDelayMs,
} from "./realtime-matches";
import {
  createState,
  recordReconnectAttempt,
  recordSocketClose,
  recordSocketOpen,
  type DashboardMetricsState,
} from "./dashboard-metrics";

type MessageListener = (event: MessageEvent) => void;
type CloseListener = () => void;

export interface RealtimeSocketValue {
  /** Se invoca con cada mensaje entrante — el listener decide si el `type` le interesa. */
  subscribeMessage: (listener: MessageListener) => () => void;
  /** Se invoca cada vez que el socket compartido se cae (antes de un intento de reconexión). */
  subscribeClose: (listener: CloseListener) => () => void;
  isConnected: () => boolean;
  /**
   * Estado de métricas del socket compartido (open/close/reconnect) — `useRealtimeMatches` lo
   * reporta. Expuesto como getter (no como valor directo) porque lee un ref: llamarlo fuera del
   * render (efectos, handlers) es obligatorio, nunca durante el render del componente.
   */
  getMetricsState: () => DashboardMetricsState;
}

const RealtimeSocketContext = createContext<RealtimeSocketValue | null>(null);

export interface RealtimeSocketProviderProps {
  /** Gate: el socket solo corre mientras `true` (ej. sesión autenticada). */
  enabled: boolean;
  children: ReactNode;
}

export function RealtimeSocketProvider({ enabled, children }: RealtimeSocketProviderProps) {
  const socketRef = useRef<WebSocket | null>(null);
  const messageListenersRef = useRef<Set<MessageListener>>(new Set());
  const closeListenersRef = useRef<Set<CloseListener>>(new Set());
  const metricsStateRef = useRef<DashboardMetricsState>(createState());

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectDelayMs = DEFAULT_INITIAL_DELAY_MS;
    let shouldReconnect = false;
    let reconnectAttempts = 0;

    function connect(): void {
      if (
        socketRef.current &&
        (socketRef.current.readyState === WebSocket.OPEN ||
          socketRef.current.readyState === WebSocket.CONNECTING)
      ) {
        return;
      }

      shouldReconnect = true;

      const ws = new WebSocket(buildMatchCountSocketUrl(window.location));
      socketRef.current = ws;

      ws.addEventListener("open", () => {
        reconnectDelayMs = DEFAULT_INITIAL_DELAY_MS; // reset del backoff tras una conexión exitosa
        reconnectAttempts = 0; // conexión exitosa: se vuelve a dar crédito completo de reintentos
        recordSocketOpen(metricsStateRef.current);
      });

      ws.addEventListener("message", (event) => {
        for (const listener of messageListenersRef.current) listener(event);
      });

      ws.addEventListener("close", () => {
        if (socketRef.current === ws) socketRef.current = null;
        recordSocketClose(metricsStateRef.current);
        for (const listener of closeListenersRef.current) listener();
        scheduleReconnect();
      });

      ws.addEventListener("error", (error) => {
        // Mismo criterio que antes de la consolidación: un cierre intencional (cleanup/unmount)
        // puede disparar un `error` de spec en un socket todavía CONNECTING sin que haya ningún
        // problema real de conectividad — no vale la pena loguearlo como si lo fuera.
        if (!shouldReconnect) return;
        console.error("[REALTIME] Error en el socket compartido del dashboard:", error);
      });
    }

    function scheduleReconnect(): void {
      if (!shouldReconnect || reconnectTimer) return;

      if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
        // Se agotaron los reintentos: se desiste del WS y se queda dependiendo del polling de
        // respaldo. Un `enabled` que vuelva a montar el provider (ej. cambio de sesión) reinicia
        // este contador desde cero.
        shouldReconnect = false;
        return;
      }

      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        if (shouldReconnect) {
          reconnectAttempts += 1;
          recordReconnectAttempt(metricsStateRef.current);
          connect();
        }
      }, reconnectDelayMs);

      reconnectDelayMs = nextReconnectDelayMs(reconnectDelayMs);
    }

    connect();

    return () => {
      shouldReconnect = false;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (socketRef.current) {
        socketRef.current.close();
        socketRef.current = null;
      }
    };
  }, [enabled]);

  const value = useMemo<RealtimeSocketValue>(
    () => ({
      subscribeMessage: (listener) => {
        messageListenersRef.current.add(listener);
        return () => messageListenersRef.current.delete(listener);
      },
      subscribeClose: (listener) => {
        closeListenersRef.current.add(listener);
        return () => closeListenersRef.current.delete(listener);
      },
      isConnected: () => !!socketRef.current && socketRef.current.readyState === WebSocket.OPEN,
      getMetricsState: () => metricsStateRef.current,
    }),
    [],
  );

  return <RealtimeSocketContext.Provider value={value}>{children}</RealtimeSocketContext.Provider>;
}

export function useRealtimeSocket(): RealtimeSocketValue {
  const ctx = useContext(RealtimeSocketContext);
  if (!ctx) {
    throw new Error("useRealtimeSocket debe usarse dentro de <RealtimeSocketProvider>.");
  }
  return ctx;
}
