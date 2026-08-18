"use client";

/**
 * `MatchesDashboard` (KAN-189/190/191) — orquestador de página del módulo
 * Matches completo, único dueño de `useRealtimeMatches` (KAN-187). Ver
 * `docs/matches-ui-design.md` §3/§4.
 *
 * Con KAN-191 quedan las 4 secciones del mini-diseño compuestas acá:
 * `NewSearchForm` (siempre visible, sin depender del WS — llama a su propio
 * `refetchActiveSearches` tras un submit exitoso), `ActiveSearchesSection`,
 * `MatchesSection` e `IncomingMatchesSection`. El `onRefetch` de
 * `useRealtimeMatches` ya agrega los `refetch()` de las 3 secciones que sí
 * dependen del WS/polling — replica
 * `Promise.all([loadMatches(), loadActiveSearches(), loadIncomingMatches()])`
 * del legacy ante `match_count_changed`.
 */

import { useAuth } from "@/lib/auth-context";
import { useActiveSearches } from "@/lib/use-active-searches";
import { useIncomingMatches } from "@/lib/use-incoming-matches";
import { useMatches } from "@/lib/use-matches";
import { useRealtimeMatches } from "@/lib/use-realtime-matches";
import { ActiveSearchesSection } from "./ActiveSearchesSection";
import { IncomingMatchesSection } from "./IncomingMatchesSection";
import { MatchesSection } from "./MatchesSection";
import { NewSearchForm } from "./NewSearchForm";

export function MatchesDashboard() {
  const { status: authStatus } = useAuth();
  const { status, matches, error, refetch: refetchMatches, sendFeedback } = useMatches();
  const {
    status: incomingStatus,
    matches: incomingMatches,
    error: incomingError,
    refetch: refetchIncoming,
  } = useIncomingMatches();
  const {
    status: activeSearchesStatus,
    searches: activeSearches,
    error: activeSearchesError,
    refetch: refetchActiveSearches,
    archive: archiveActiveSearch,
    reactivate: reactivateActiveSearch,
  } = useActiveSearches();

  useRealtimeMatches({
    enabled: authStatus === "authenticated",
    onRefetch: () => Promise.all([refetchMatches(), refetchIncoming(), refetchActiveSearches()]),
  });

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
      <NewSearchForm onSubmitted={() => void refetchActiveSearches()} />
      <ActiveSearchesSection
        status={activeSearchesStatus}
        searches={activeSearches}
        error={activeSearchesError}
        onArchive={archiveActiveSearch}
        onReactivate={reactivateActiveSearch}
      />
      <MatchesSection status={status} matches={matches} error={error} sendFeedback={sendFeedback} />
      <IncomingMatchesSection
        status={incomingStatus}
        matches={incomingMatches}
        error={incomingError}
      />
    </div>
  );
}
