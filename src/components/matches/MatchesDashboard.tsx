"use client";

/**
 * `MatchesDashboard` (KAN-189/190) — orquestador de página del módulo
 * Matches, único dueño de `useRealtimeMatches` (KAN-187). Ver
 * `docs/matches-ui-design.md` §3/§4.
 *
 * KAN-189 implementó "Últimos Matches"; KAN-190 suma "Interesados en tus
 * Propiedades" acá mismo, agregando su `refetch()` al `Promise.all` del
 * `onRefetch` (mismo criterio que `Promise.all([loadMatches(),
 * loadActiveSearches(), loadIncomingMatches()])` del legacy ante
 * `match_count_changed`). `ActiveSearchesSection` (KAN-191) todavía no
 * existe — falta sumar su `refetch()` cuando se implemente.
 */

import { useAuth } from "@/lib/auth-context";
import { useIncomingMatches } from "@/lib/use-incoming-matches";
import { useMatches } from "@/lib/use-matches";
import { useRealtimeMatches } from "@/lib/use-realtime-matches";
import { IncomingMatchesSection } from "./IncomingMatchesSection";
import { MatchesSection } from "./MatchesSection";

export function MatchesDashboard() {
  const { status: authStatus } = useAuth();
  const { status, matches, error, refetch: refetchMatches, sendFeedback } = useMatches();
  const {
    status: incomingStatus,
    matches: incomingMatches,
    error: incomingError,
    refetch: refetchIncoming,
  } = useIncomingMatches();

  useRealtimeMatches({
    enabled: authStatus === "authenticated",
    onRefetch: () => Promise.all([refetchMatches(), refetchIncoming()]),
  });

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
      <MatchesSection status={status} matches={matches} error={error} sendFeedback={sendFeedback} />
      <IncomingMatchesSection
        status={incomingStatus}
        matches={incomingMatches}
        error={incomingError}
      />
    </div>
  );
}
