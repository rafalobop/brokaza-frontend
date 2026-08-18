"use client";

/**
 * Hook `useMatches` (KAN-189) — estado de datos de la vista "Últimos
 * Matches". Estado local (no Context): sigue el criterio de
 * `react-state-management` documentado en `docs/matches-ui-design.md` §3 —
 * solo `MatchesDashboard`/`MatchesSection` consumen estos datos, no hace
 * falta un store global.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "./api-client";
import { getMatches, sendMatchFeedback, type Match, type MatchReviewStatus } from "./matches-api";

export type MatchesStatus = "loading" | "loaded" | "error";

export interface UseMatchesResult {
  status: MatchesStatus;
  matches: Match[];
  error: string | null;
  /** Vuelve a pedir `GET /api/matches`. Usado por el polling/WS de `MatchesDashboard` (KAN-187). */
  refetch: () => Promise<void>;
  /**
   * Envía `POST /api/matches/:id/feedback` y refetchea la lista al terminar
   * — mismo criterio que el legacy (`sendFeedback` en `app.js`): no hace
   * update optimista local, confía en el estado que devuelve el backend.
   */
  sendFeedback: (
    matchId: string,
    status: Extract<MatchReviewStatus, "ACCEPTED" | "REJECTED">,
    reason?: string | null,
  ) => Promise<void>;
}

export function useMatches(): UseMatchesResult {
  const [status, setStatus] = useState<MatchesStatus>("loading");
  const [matches, setMatches] = useState<Match[]>([]);
  const [error, setError] = useState<string | null>(null);

  // `refetch` también lo dispara `useRealtimeMatches` (KAN-187) desde un
  // WS/interval externo al ciclo de vida de este hook — el guard evita
  // setState tras un unmount en esa carrera, no solo en el fetch inicial.
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refetch = useCallback(async () => {
    try {
      const res = await getMatches();
      if (!isMountedRef.current) return;
      setMatches(res.matches);
      setStatus("loaded");
      setError(null);
    } catch (err) {
      if (!isMountedRef.current) return;
      const message =
        err instanceof ApiError ? err.message : "Error al obtener los matches encontrados.";
      setError(message);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await refetch();
    })();
  }, [refetch]);

  const sendFeedback = useCallback(
    async (
      matchId: string,
      feedbackStatus: Extract<MatchReviewStatus, "ACCEPTED" | "REJECTED">,
      reason: string | null = null,
    ) => {
      await sendMatchFeedback(matchId, feedbackStatus, reason);
      await refetch();
    },
    [refetch],
  );

  return { status, matches, error, refetch, sendFeedback };
}
