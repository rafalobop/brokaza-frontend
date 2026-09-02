"use client";

/**
 * `CollaboratorRow` (KAN-306) — una fila de la lista de colaboradores, con badge de estado de
 * validación de matrícula (AC6, supervisión) y acción de revocar acceso. Mismo patrón de
 * confirmación que `PropertyRow` (`ConfirmModal`, no `window.confirm`).
 */

import { useState } from "react";
import { ApiError } from "@/lib/api-client";
import type { Collaborator } from "@/lib/team-api";
import type { LicenseValidationStatus } from "@/lib/profile-context";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";

export interface CollaboratorRowProps {
  collaborator: Collaborator;
  onRevoke: (collaboratorId: string) => Promise<void>;
}

const VALIDATION_STATUS_VARIANT: Record<LicenseValidationStatus, BadgeVariant> = {
  validated: "success",
  pending: "warning",
  rejected: "error",
};

const VALIDATION_STATUS_LABELS: Record<LicenseValidationStatus, string> = {
  validated: "Matrícula validada",
  pending: "Validación pendiente",
  rejected: "Matrícula rechazada",
};

export function CollaboratorRow({ collaborator, onRevoke }: CollaboratorRowProps) {
  const [revoking, setRevoking] = useState(false);
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);

  async function handleRevoke() {
    setRevoking(true);
    setRowError(null);
    try {
      await onRevoke(collaborator.id);
    } catch (err) {
      setRowError(err instanceof ApiError ? err.message : "No se pudo revocar el acceso.");
      setRevoking(false);
    } finally {
      setConfirmingRevoke(false);
    }
  }

  return (
    <div className="rounded-radius-md border-card-border bg-card flex flex-col gap-2 border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-foreground truncate text-sm font-medium">
            {collaborator.full_name || collaborator.email}
          </p>
          <p className="text-text-secondary truncate text-xs">{collaborator.email}</p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Badge variant={VALIDATION_STATUS_VARIANT[collaborator.license_validation_status]}>
            {VALIDATION_STATUS_LABELS[collaborator.license_validation_status]}
          </Badge>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => setConfirmingRevoke(true)}
            disabled={revoking}
          >
            {revoking ? "Revocando..." : "Revocar"}
          </Button>
        </div>
      </div>

      {confirmingRevoke ? (
        <ConfirmModal
          title="Revocar acceso"
          message={`¿Revocar el acceso de ${collaborator.full_name || collaborator.email}? Vuelve a ser una cuenta independiente, fuera de tu agencia.`}
          confirmLabel="Revocar"
          confirming={revoking}
          onConfirm={() => void handleRevoke()}
          onCancel={() => setConfirmingRevoke(false)}
        />
      ) : null}

      {rowError ? <p className="text-error text-sm">{rowError}</p> : null}
    </div>
  );
}
