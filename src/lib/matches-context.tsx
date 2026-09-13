"use client";

/**
 * `MatchesProvider` — mueve la dueñidad de `useActiveSearches`/`useIncomingMatches` +
 * `useRealtimeMatches` (antes toda en `MatchesDashboard`) a un Context montado una sola vez en
 * el layout del dashboard. Necesario porque el shell (sidebar con rutas reales: Resumen,
 * Matches, Búsquedas) reparte esas vistas en páginas distintas — sin este Context, cada página
 * abriría su propio WebSocket (`useRealtimeMatches`) al montar, duplicando conexiones cada vez
 * que se navega entre rutas hermanas.
 *
 * También monta acá `RealtimeSocketProvider` (`realtime-socket-context.tsx`) — el socket
 * compartido a `/ws` que antes solo usaba `useRealtimeMatches` y ahora también consume `useUpload`
 * (KAN-338), evitando que una subida de Excel abra una segunda conexión en paralelo a la que ya
 * mantiene este provider.
 *
 * No incluye `useMatches` (resultados de las propias búsquedas del tenant) — decisión de
 * producto: ese dato no se muestra en ningún lado del frontend (ver comentario en
 * `matches-api.ts`), así que no hace falta pagar su fetch/WS-refetch acá.
 */

import { createContext, useContext, useMemo, type ReactNode } from "react";
import { useAuth } from "./auth-context";
import { useActiveSearches, type UseActiveSearchesResult } from "./use-active-searches";
import { useIncomingMatches, type UseIncomingMatchesResult } from "./use-incoming-matches";
import { useRealtimeMatches } from "./use-realtime-matches";
import { RealtimeSocketProvider } from "./realtime-socket-context";

interface MatchesContextValue {
  incomingMatches: UseIncomingMatchesResult;
  activeSearches: UseActiveSearchesResult;
}

const MatchesContext = createContext<MatchesContextValue | null>(null);

export function MatchesProvider({ children }: { children: ReactNode }) {
  const { status: authStatus } = useAuth();

  return (
    <RealtimeSocketProvider enabled={authStatus === "authenticated"}>
      <MatchesContextBridge>{children}</MatchesContextBridge>
    </RealtimeSocketProvider>
  );
}

function MatchesContextBridge({ children }: { children: ReactNode }) {
  const { status: authStatus } = useAuth();
  const incomingMatches = useIncomingMatches();
  const activeSearches = useActiveSearches();

  useRealtimeMatches({
    enabled: authStatus === "authenticated",
    onRefetch: () => Promise.all([incomingMatches.refetch(), activeSearches.refetch()]),
  });

  const value = useMemo(
    () => ({ incomingMatches, activeSearches }),
    [incomingMatches, activeSearches],
  );

  return <MatchesContext.Provider value={value}>{children}</MatchesContext.Provider>;
}

export function useMatchesContext(): MatchesContextValue {
  const ctx = useContext(MatchesContext);
  if (!ctx) {
    throw new Error("useMatchesContext debe usarse dentro de <MatchesProvider>.");
  }
  return ctx;
}
