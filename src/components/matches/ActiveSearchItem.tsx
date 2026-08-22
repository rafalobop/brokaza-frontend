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
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export interface ActiveSearchItemProps {
  search: ActiveSearch;
  onArchive: (searchId: string) => Promise<void>;
  onReactivate: (searchId: string) => Promise<void>;
}

const STATUS_VARIANT: Record<ActiveSearch["status"], BadgeVariant> = {
  active: "success",
  expired: "error",
};

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
    <div className="rounded-radius-md border-card-border bg-card flex flex-col gap-2 border p-3">
      <p className="text-foreground text-sm font-medium">{buildSearchSummary(search.criteria)}</p>
      <p className="text-text-secondary text-sm italic">&quot;{search.raw_text}&quot;</p>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={STATUS_VARIANT[search.status]}>{SEARCH_STATUS_LABELS[search.status]}</Badge>
        <Badge variant="info">
          {search.matches_count} match{search.matches_count === 1 ? "" : "es"}
        </Badge>
        {!isExpired ? (
          <Badge variant={isUrgent ? "warning" : "info"}>
            {search.days_remaining} día{search.days_remaining === 1 ? "" : "s"} restante
            {search.days_remaining === 1 ? "" : "s"}
          </Badge>
        ) : null}
      </div>

      {actionError ? <p className="text-error text-sm">{actionError}</p> : null}

      <div className="flex gap-2">
        {isExpired ? (
          <Button
            type="button"
            variant="success"
            size="sm"
            onClick={() => void handleReactivate()}
            disabled={busy}
          >
            Reactivar
          </Button>
        ) : null}
        <Button
          type="button"
          variant="danger"
          size="sm"
          onClick={() => void handleArchive()}
          disabled={busy}
        >
          Archivar
        </Button>
      </div>
    </div>
  );
}
