"use client";

/**
 * `CollaboratorRow` (KAN-306) — una fila de la lista de colaboradores. Mismo patrón de
 * confirmación que `PropertyRow` (`ConfirmModal`, no `window.confirm`).
 *
 * Pase de UI (2026-09-04, puntos 5 y 6):
 * - El badge de estado dejó de usar `license_validation_status` — ese campo nunca sale de
 *   `'pending'` para un colaborador (no pasa por la validación de matrícula, ver
 *   `profileController.ts#updateProfile`), así que el pill quedaba pegado en "Validación
 *   pendiente" aunque el invitado ya hubiera completado su registro. Ahora se deriva de
 *   `profile_completed` (invitación todavía no confirmada vs. colaborador activo).
 * - Dos acciones separadas según el estado: "Revocar" para una invitación sin confirmar
 *   (cancela la invitación) y "Dar de baja" para un colaborador ya activo (le corta el acceso).
 *   Ambas pegan al mismo endpoint (`onRevoke`) — solo cambia la copia mostrada al usuario. Un
 *   colaborador revocado no tiene ninguna de las dos, solo "Reactivar" (`onReactivate`).
 */

import { useState } from "react";
import { ApiError } from "@/lib/api-client";
import type { Collaborator } from "@/lib/team-api";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

export interface CollaboratorRowProps {
  collaborator: Collaborator;
  onRevoke: (collaboratorId: string) => Promise<void>;
  onReactivate: (collaboratorId: string) => Promise<void>;
}

export function CollaboratorRow({ collaborator, onRevoke, onReactivate }: CollaboratorRowProps) {
  const [busy, setBusy] = useState(false);
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  const isRevoked = collaborator.collaborator_status === "revoked";
  const isPendingInvite = !isRevoked && !collaborator.profile_completed;

  const statusBadge: { label: string; variant: BadgeVariant } = isRevoked
    ? { label: "Revocado", variant: "error" }
    : isPendingInvite
      ? { label: "Invitación pendiente", variant: "warning" }
      : { label: "Activo", variant: "success" };

  const displayName = collaborator.full_name || collaborator.email;

  async function handleRevoke() {
    setBusy(true);
    setRowError(null);
    try {
      await onRevoke(collaborator.id);
    } catch (err) {
      setRowError(err instanceof ApiError ? err.message : "No se pudo actualizar el acceso.");
      setBusy(false);
    } finally {
      setConfirmingRevoke(false);
    }
  }

  async function handleReactivate() {
    setBusy(true);
    setRowError(null);
    try {
      await onReactivate(collaborator.id);
    } catch (err) {
      setRowError(err instanceof ApiError ? err.message : "No se pudo reactivar el acceso.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-radius-md border-card-border bg-card flex flex-col gap-2 border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-foreground truncate text-sm font-medium">{displayName}</p>
          <p className="text-text-secondary truncate text-xs">{collaborator.email}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
          {isRevoked ? (
            <Button
              type="button"
              variant="success"
              size="sm"
              onClick={() => void handleReactivate()}
              disabled={busy}
            >
              {busy ? "Reactivando..." : "Reactivar"}
            </Button>
          ) : (
            <Button
              type="button"
              variant="danger"
              size="sm"
              onClick={() => setConfirmingRevoke(true)}
              disabled={busy}
            >
              {busy ? "Procesando..." : isPendingInvite ? "Revocar" : "Dar de baja"}
            </Button>
          )}
        </div>
      </div>

      {confirmingRevoke ? (
        <ConfirmModal
          title={isPendingInvite ? "Revocar invitación" : "Dar de baja acceso"}
          message={
            isPendingInvite
              ? `¿Revocar la invitación de ${displayName}? Todavía no completó su registro.`
              : `¿Dar de baja el acceso de ${displayName}? Deja de ver la cartera de tu agencia, pero podés reactivarlo después.`
          }
          confirmLabel={isPendingInvite ? "Revocar" : "Dar de baja"}
          confirming={busy}
          onConfirm={() => void handleRevoke()}
          onCancel={() => setConfirmingRevoke(false)}
        />
      ) : null}

      {rowError ? <p className="text-error text-sm">{rowError}</p> : null}
    </div>
  );
}
