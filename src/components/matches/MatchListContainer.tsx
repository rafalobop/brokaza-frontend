"use client";

/**
 * `MatchListContainer` (KAN-189/KAN-188 §2) — renderiza los matches ya
 * ordenados y paginados por `MatchesSection`. Componente "tonto": no sabe de
 * orden ni de red, solo mapea `Match[]` a `MatchItem`.
 */

import type { Match } from "@/lib/matches-api";
import { MatchItem } from "./MatchItem";

export interface MatchListContainerProps {
  matches: Match[];
  onAccept: (matchId: string) => void;
  onReject: (matchId: string) => void;
  actionsDisabled: boolean;
}

export function MatchListContainer({
  matches,
  onAccept,
  onReject,
  actionsDisabled,
}: MatchListContainerProps) {
  if (matches.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        No se han registrado matches en esta sesión.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {matches.map((match) => (
        <MatchItem
          key={match.id}
          match={match}
          onAccept={onAccept}
          onReject={onReject}
          actionsDisabled={actionsDisabled}
        />
      ))}
    </div>
  );
}
