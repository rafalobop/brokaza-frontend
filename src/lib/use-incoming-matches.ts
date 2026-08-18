"use client";

/**
 * Hook `useIncomingMatches` (KAN-190) — estado de datos de la vista
 * "Interesados en tus Propiedades", solo lectura (dirección recíproca de
 * `useMatches`, KAN-189/KAN-78: la curación de aceptar/rechazar es
 * exclusiva del buscador). Estado local, mismo criterio de
 * `docs/matches-ui-design.md` §3 — sin store global.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "./api-client";
import { getIncomingMatches, type IncomingMatch } from "./matches-api";

export type IncomingMatchesStatus = "loading" | "loaded" | "error";

export interface UseIncomingMatchesResult {
  status: IncomingMatchesStatus;
  matches: IncomingMatch[];
  error: string | null;
  /** Vuelve a pedir `GET /api/matches/incoming`. Usado por `useRealtimeMatches` (KAN-187). */
  refetch: () => Promise<void>;
}

export function useIncomingMatches(): UseIncomingMatchesResult {
  const [status, setStatus] = useState<IncomingMatchesStatus>("loading");
  const [matches, setMatches] = useState<IncomingMatch[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Mismo guard que `useMatches` (KAN-189): `refetch` lo dispara también el
  // WS/polling externo de KAN-187, que puede sobrevivir a un unmount.
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refetch = useCallback(async () => {
    try {
      const res = await getIncomingMatches();
      if (!isMountedRef.current) return;
      setMatches(res.matches);
      setStatus("loaded");
      setError(null);
    } catch (err) {
      if (!isMountedRef.current) return;
      const message =
        err instanceof ApiError
          ? err.message
          : "Error al obtener los interesados en tus propiedades.";
      setError(message);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await refetch();
    })();
  }, [refetch]);

  return { status, matches, error, refetch };
}
