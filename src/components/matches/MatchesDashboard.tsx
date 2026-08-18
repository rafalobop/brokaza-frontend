"use client";

/**
 * `MatchesDashboard` (KAN-189) — orquestador de página del módulo Matches,
 * único dueño de `useRealtimeMatches` (KAN-187). Ver `docs/matches-ui-design.md`
 * §3/§4.
 *
 * KAN-189 solo implementa la sección "Últimos Matches" — `ActiveSearchesSection`
 * (KAN-191) e `IncomingMatchesSection` (KAN-190) todavía no existen. El
 * `onRefetch` de acá solo agrega `refetchMatches()` por ahora; KAN-190/191
 * deben extenderlo agregando sus propios `refetch()` al `Promise.all`, tal
 * como especifica el mini-diseño — no hace falta tocar `useRealtimeMatches`
 * en sí para eso.
 */

import { useAuth } from "@/lib/auth-context";
import { useMatches } from "@/lib/use-matches";
import { useRealtimeMatches } from "@/lib/use-realtime-matches";
import { MatchesSection } from "./MatchesSection";

export function MatchesDashboard() {
  const { status: authStatus } = useAuth();
  const { status, matches, error, refetch: refetchMatches, sendFeedback } = useMatches();

  useRealtimeMatches({
    enabled: authStatus === "authenticated",
    onRefetch: () => refetchMatches(),
  });

  return (
    <div className="flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
      <MatchesSection status={status} matches={matches} error={error} sendFeedback={sendFeedback} />
    </div>
  );
}
