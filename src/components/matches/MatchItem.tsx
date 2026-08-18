"use client";

/**
 * `MatchItem` (KAN-189) — acordeón de un match individual, portado de
 * `buildMatchItem` en `matchouse/src/dashboard/app.js` (líneas 1062-1137).
 * Juega el rol de "detalle" que el AC de KAN-188 pedía como
 * `MatchDetailContainer` separado — ver `docs/matches-ui-design.md` §2 para
 * la justificación de por qué el detalle vive inline acá en vez de en un
 * componente aparte.
 */

import { isZoneMatchReason, ZONE_MATCH_TOOLTIP } from "@/lib/match-zone-tooltip";
import type { Match } from "@/lib/matches-api";

const STATUS_BADGE: Record<Match["userReviewStatus"], { label: string; className: string }> = {
  PENDING: {
    label: "Pendiente",
    className: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  },
  ACCEPTED: {
    label: "Aceptado",
    className: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300",
  },
  REJECTED: {
    label: "Rechazado",
    className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  },
};

export interface MatchItemProps {
  match: Match;
  onAccept: (matchId: string) => void;
  onReject: (matchId: string) => void;
  actionsDisabled: boolean;
}

export function MatchItem({ match, onAccept, onReject, actionsDisabled }: MatchItemProps) {
  const badge = STATUS_BADGE[match.userReviewStatus] ?? STATUS_BADGE.PENDING;

  return (
    <details className="rounded-lg border border-zinc-200 dark:border-zinc-800">
      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="flex flex-col">
          <strong className="text-black dark:text-zinc-50">{match.property.domicilio}</strong>
          <span className="text-sm text-zinc-600 dark:text-zinc-400">
            {match.property.moneda} {match.property.precio} ({match.property.operacion})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{match.fecha}</span>
          <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs font-medium text-white dark:bg-zinc-100 dark:text-black">
            {match.score}%
          </span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}>
            {badge.label}
          </span>
        </div>
      </summary>

      <div className="flex flex-col gap-3 border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <p className="text-sm text-zinc-700 italic dark:text-zinc-300">
          &quot;{match.searchText}&quot;
        </p>

        {match.reasons.length > 0 ? (
          <ul className="flex list-inside list-disc flex-col gap-1 text-sm text-zinc-600 dark:text-zinc-400">
            {match.reasons.map((reason, index) => (
              <li
                key={`${reason}-${index}`}
                title={isZoneMatchReason(reason) ? ZONE_MATCH_TOOLTIP : undefined}
                className={isZoneMatchReason(reason) ? "underline decoration-dotted" : undefined}
              >
                {reason}
              </li>
            ))}
          </ul>
        ) : null}

        {match.userReviewStatus === "REJECTED" ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Motivo: {match.feedbackReason || "No especificado"}
          </p>
        ) : null}

        {match.userReviewStatus === "PENDING" ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onAccept(match.id)}
              disabled={actionsDisabled}
              className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
            >
              Aceptar
            </button>
            <button
              type="button"
              onClick={() => onReject(match.id)}
              disabled={actionsDisabled}
              className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
            >
              Rechazar
            </button>
          </div>
        ) : null}
      </div>
    </details>
  );
}
