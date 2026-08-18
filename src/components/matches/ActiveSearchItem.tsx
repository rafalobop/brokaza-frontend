"use client";

/**
 * `ActiveSearchItem` (KAN-191) — port de `buildActiveSearchItem` en
 * `matchouse/src/dashboard/app.js` (líneas 1365-1405). Usa `window.confirm`
 * antes de archivar, igual que el legacy (`archiveSearch`, líneas
 * 1407-1425) — no se introduce un modal nuevo para esto, fuera de alcance
 * del ticket.
 */

import { useState } from "react";
import { buildSearchSummary, SEARCH_STATUS_LABELS } from "@/lib/active-search-summary";
import type { ActiveSearch } from "@/lib/matches-api";

export interface ActiveSearchItemProps {
  search: ActiveSearch;
  onArchive: (searchId: string) => Promise<void>;
  onReactivate: (searchId: string) => Promise<void>;
}

export function ActiveSearchItem({ search, onArchive, onReactivate }: ActiveSearchItemProps) {
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isExpired = search.status === "expired";
  const isUrgent = search.status === "active" && search.days_remaining <= 2;

  async function handleArchive() {
    if (!window.confirm("¿Archivar esta búsqueda? Dejará de aparecer en tus búsquedas activas.")) {
      return;
    }
    setBusy(true);
    setActionError(null);
    try {
      await onArchive(search.id);
    } catch {
      setActionError("No se pudo archivar la búsqueda.");
      setBusy(false);
    }
  }

  async function handleReactivate() {
    setBusy(true);
    setActionError(null);
    try {
      await onReactivate(search.id);
    } catch {
      setActionError("No se pudo reactivar la búsqueda.");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
      <p className="text-sm font-medium text-black dark:text-zinc-50">
        {buildSearchSummary(search.criteria)}
      </p>
      <p className="text-sm text-zinc-600 italic dark:text-zinc-400">
        &quot;{search.raw_text}&quot;
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          {SEARCH_STATUS_LABELS[search.status]}
        </span>
        <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          {search.matches_count} match{search.matches_count === 1 ? "" : "es"}
        </span>
        {!isExpired ? (
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              isUrgent
                ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                : "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
            }`}
          >
            {search.days_remaining} día{search.days_remaining === 1 ? "" : "s"} restante
            {search.days_remaining === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>

      {actionError ? <p className="text-sm text-red-600 dark:text-red-400">{actionError}</p> : null}

      <div className="flex gap-2">
        {isExpired ? (
          <button
            type="button"
            onClick={() => void handleReactivate()}
            disabled={busy}
            className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
          >
            Reactivar
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => void handleArchive()}
          disabled={busy}
          className="rounded-md bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
        >
          Archivar
        </button>
      </div>
    </div>
  );
}
