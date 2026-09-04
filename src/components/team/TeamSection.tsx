"use client";

/**
 * `TeamSection` (KAN-306) — vista "Equipo": lista de colaboradores de la agencia del dueño
 * autenticado, con estado de acceso (AC6) y revocar/reactivar (AC4). El caso `"forbidden"` (un
 * `role: "collaborator"` que llega por URL directa) muestra un mensaje explicativo en vez del
 * formulario/lista — el nav ya oculta este link para ese caso (`(dashboard)/layout.tsx`), esto es
 * la segunda capa de defensa, no la primera.
 *
 * Pase de UI (2026-09-04, punto 6): pestañas "Activos" (invitaciones pendientes + colaboradores
 * confirmados, ambos con `collaborator_status !== 'revoked'`) y "Revocados" (con acceso cortado,
 * reactivables). Split client-side sobre la misma lista — volumen bajo, no amerita un endpoint
 * filtrado.
 */

import { useMemo, useState } from "react";
import type { TeamStatus } from "@/lib/use-team";
import type { Collaborator } from "@/lib/team-api";
import { Card } from "@/components/ui/Card";
import { InviteCollaboratorForm } from "./InviteCollaboratorForm";
import { CollaboratorRow } from "./CollaboratorRow";

export interface TeamSectionProps {
  status: TeamStatus;
  collaborators: Collaborator[];
  error: string | null;
  onInvited: () => void;
  onRevoke: (collaboratorId: string) => Promise<void>;
  onReactivate: (collaboratorId: string) => Promise<void>;
}

type Tab = "active" | "revoked";

const TABS: { key: Tab; label: string }[] = [
  { key: "active", label: "Activos" },
  { key: "revoked", label: "Revocados" },
];

export function TeamSection({
  status,
  collaborators,
  error,
  onInvited,
  onRevoke,
  onReactivate,
}: TeamSectionProps) {
  const [tab, setTab] = useState<Tab>("active");

  const visibleCollaborators = useMemo(
    () =>
      collaborators.filter((collaborator) =>
        tab === "revoked"
          ? collaborator.collaborator_status === "revoked"
          : collaborator.collaborator_status !== "revoked",
      ),
    [collaborators, tab],
  );

  if (status === "forbidden") {
    return (
      <Card>
        <p className="text-text-secondary text-sm">
          Solo los dueños de agencia pueden acceder a esta sección.
        </p>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <InviteCollaboratorForm onInvited={onInvited} />

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-foreground text-lg font-semibold">Colaboradores</h2>
          <div className="border-card-border flex gap-1 rounded-full border p-1 text-sm">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key)}
                className={`rounded-full px-3 py-1 font-medium transition-colors ${
                  tab === key
                    ? "bg-accent text-white"
                    : "text-text-secondary hover:bg-white/10"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {status === "loading" ? (
          <p className="text-text-secondary text-sm">Cargando equipo...</p>
        ) : status === "error" ? (
          <p className="text-error text-sm">{error ?? "Error al obtener el equipo."}</p>
        ) : visibleCollaborators.length === 0 ? (
          <p className="text-text-secondary text-sm">
            {tab === "revoked"
              ? "No tenés colaboradores revocados."
              : "Todavía no otorgaste acceso a ningún colaborador."}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {visibleCollaborators.map((collaborator) => (
              <CollaboratorRow
                key={collaborator.id}
                collaborator={collaborator}
                onRevoke={onRevoke}
                onReactivate={onReactivate}
              />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
