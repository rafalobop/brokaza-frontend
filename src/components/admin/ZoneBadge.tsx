/**
 * `ZoneBadge` (KAN-240) — port de `zoneBadge()` en `matchouse/src/admin-dashboard/htmlSanitize.js`.
 * En el legacy necesitaba `escapeHtml` manual porque interpolaba HTML crudo (`innerHTML`) — acá
 * no hace falta: JSX escapa texto y atributos automáticamente.
 */

import type { AdminProperty } from "@/lib/properties-api";

export function ZoneBadge({ property }: { property: AdminProperty }) {
  if (property.hasDiscrepancy && property.zone && property.textSuggestedZone) {
    const title = `Punto: ${property.zone.name} | Texto sugiere: ${property.textSuggestedZone.name}`;
    return (
      <span
        title={title}
        className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
      >
        ⚠ {property.zone.name}
      </span>
    );
  }

  if (property.zoneSource === "none" || !property.zone) {
    return (
      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
        Sin zona resuelta
      </span>
    );
  }

  if (property.zoneSource === "text") {
    return (
      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-900/40 dark:text-blue-300">
        {property.zone.name} (por texto)
      </span>
    );
  }

  return (
    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
      {property.zone.name}
    </span>
  );
}
