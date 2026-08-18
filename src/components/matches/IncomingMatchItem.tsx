"use client";

/**
 * `IncomingMatchItem` (KAN-190) — acordeón de un match entrante, portado de
 * `buildIncomingMatchItem` en `matchouse/src/dashboard/app.js` (líneas
 * 1170-1227). Solo lectura: sin acciones de aceptar/rechazar (esa curación
 * es exclusiva del buscador, ver `useMatches`/KAN-189).
 */

import { isZoneMatchReason, ZONE_MATCH_TOOLTIP } from "@/lib/match-zone-tooltip";
import type { IncomingMatch } from "@/lib/matches-api";

function buildContactLabel(contact: IncomingMatch["searcherContact"]): string {
  const parts = [contact.full_name, contact.agency_name].filter(
    (value): value is string => !!value,
  );
  return parts.length > 0 ? parts.join(" · ") : "Sin datos de contacto";
}

export interface IncomingMatchItemProps {
  match: IncomingMatch;
}

export function IncomingMatchItem({ match }: IncomingMatchItemProps) {
  const { searcherContact: contact } = match;
  const phoneDigits = (contact.phone_number || "").replace(/\D/g, "");

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
        </div>
      </summary>

      <div className="flex flex-col gap-3 border-t border-zinc-200 px-4 py-3 dark:border-zinc-800">
        <p className="text-sm text-zinc-700 italic dark:text-zinc-300">
          &quot;{match.searchText}&quot;
        </p>

        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          <strong>Interesado:</strong> {buildContactLabel(contact)}
          {phoneDigits ? (
            <>
              {" — "}
              <a
                href={`https://wa.me/${phoneDigits}`}
                target="_blank"
                rel="noreferrer"
                className="text-emerald-700 underline underline-offset-2 dark:text-emerald-400"
              >
                {contact.phone_number}
              </a>
            </>
          ) : contact.phone_number ? (
            <> — {contact.phone_number}</>
          ) : null}
          {contact.email ? (
            <>
              {" — "}
              <a
                href={`mailto:${contact.email}`}
                className="text-emerald-700 underline underline-offset-2 dark:text-emerald-400"
              >
                {contact.email}
              </a>
            </>
          ) : null}
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
      </div>
    </details>
  );
}
