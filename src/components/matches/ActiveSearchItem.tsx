"use client";

/**
 * `ActiveSearchItem` (KAN-191) — port de `buildActiveSearchItem` en
 * `matchouse/src/dashboard/app.js` (líneas 1365-1405). Usa `ConfirmModal`
 * antes de archivar, mismo patrón que `CollaboratorRow`/`PropertyRow`.
 */

import { useState } from "react";
import { buildSearchSummary, SEARCH_STATUS_LABELS } from "@/lib/active-search-summary";
import type { ActiveSearch } from "@/lib/matches-api";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

export interface ActiveSearchItemProps {
  search: ActiveSearch;
  onArchive: (searchId: string) => Promise<void>;
  onReactivate: (searchId: string) => Promise<void>;
}

const STATUS_VARIANT: Record<ActiveSearch["status"], BadgeVariant> = {
  active: "success",
  expired: "error",
  matched: "info",
  cancelled: "info",
};

export function ActiveSearchItem({ search, onArchive, onReactivate }: ActiveSearchItemProps) {
  const [busy, setBusy] = useState(false);
  const [confirmingArchive, setConfirmingArchive] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const isExpired = search.status === "expired";
  const isArchived = search.status === "matched" || search.status === "cancelled";
  const isUrgent = search.status === "active" && search.days_remaining <= 2;

  async function handleArchive() {
    setBusy(true);
    setActionError(null);
    try {
      await onArchive(search.id);
    } catch {
      setActionError("No se pudo archivar la búsqueda.");
      setBusy(false);
    } finally {
      setConfirmingArchive(false);
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

      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={STATUS_VARIANT[search.status]}>
            {SEARCH_STATUS_LABELS[search.status]}
          </Badge>
          <Badge variant="info">
            {search.matches_count} match{search.matches_count === 1 ? "" : "es"}
          </Badge>
          {search.status === "active" ? (
            <Badge variant={isUrgent ? "warning" : "info"}>
              {search.days_remaining} día{search.days_remaining === 1 ? "" : "s"} restante
              {search.days_remaining === 1 ? "" : "s"}
            </Badge>
          ) : null}
        </div>

        {!isArchived ? (
          <div className="flex shrink-0 gap-2">
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
              onClick={() => setConfirmingArchive(true)}
              disabled={busy}
            >
              Archivar
            </Button>
          </div>
        ) : null}
      </div>

      {confirmingArchive ? (
        <ConfirmModal
          title="Archivar búsqueda"
          message="¿Archivar esta búsqueda? Dejará de aparecer en tus búsquedas activas."
          confirmLabel="Archivar"
          confirming={busy}
          onConfirm={() => void handleArchive()}
          onCancel={() => setConfirmingArchive(false)}
        />
      ) : null}

      {actionError ? <p className="text-error text-sm">{actionError}</p> : null}
    </div>
  );
}
