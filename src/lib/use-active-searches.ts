"use client";

/**
 * Hook `useActiveSearches` (KAN-191) — estado de datos de la vista "Mis
 * Búsquedas en Curso": `GET /api/searches` + archivar/reactivar. Estado
 * local, mismo criterio de `docs/matches-ui-design.md` §3 — sin store
 * global. `NewSearchForm` no usa este hook directamente: llama a su propio
 * `refetch()` (pasado como prop desde `MatchesDashboard`) tras un
 * `POST /api/search` exitoso, tal cual especifica §4 del mini-diseño.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "./api-client";
import {
  archiveActiveSearch,
  getActiveSearches,
  reactivateActiveSearch,
  type ActiveSearch,
} from "./matches-api";

export type ActiveSearchesStatus = "loading" | "loaded" | "error";

export interface UseActiveSearchesResult {
  status: ActiveSearchesStatus;
  searches: ActiveSearch[];
  error: string | null;
  /** Vuelve a pedir `GET /api/searches`. Usado por `useRealtimeMatches` (KAN-187) y `NewSearchForm`. */
  refetch: () => Promise<void>;
  archive: (searchId: string) => Promise<void>;
  reactivate: (searchId: string) => Promise<void>;
}

export function useActiveSearches(): UseActiveSearchesResult {
  const [status, setStatus] = useState<ActiveSearchesStatus>("loading");
  const [searches, setSearches] = useState<ActiveSearch[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Mismo guard que `useMatches`/`useIncomingMatches` (KAN-189/190).
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refetch = useCallback(async () => {
    try {
      const res = await getActiveSearches();
      if (!isMountedRef.current) return;
      setSearches(res.searches);
      setStatus("loaded");
      setError(null);
    } catch (err) {
      if (!isMountedRef.current) return;
      const message =
        err instanceof ApiError ? err.message : "Error al obtener tus búsquedas activas.";
      setError(message);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await refetch();
    })();
  }, [refetch]);

  const archive = useCallback(
    async (searchId: string) => {
      await archiveActiveSearch(searchId);
      await refetch();
    },
    [refetch],
  );

  const reactivate = useCallback(
    async (searchId: string) => {
      await reactivateActiveSearch(searchId);
      await refetch();
    },
    [refetch],
  );

  return { status, searches, error, refetch, archive, reactivate };
}
