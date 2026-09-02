"use client";

/**
 * `TeamSection` (KAN-306) — vista "Equipo": lista de colaboradores de la agencia del dueño
 * autenticado, con estado de validación de matrícula (AC6) y revocar acceso (AC4). El caso
 * `"forbidden"` (un `role: "collaborator"` que llega por URL directa) muestra un mensaje
 * explicativo en vez del formulario/lista — el nav ya oculta este link para ese caso
 * (`(dashboard)/layout.tsx`), esto es la segunda capa de defensa, no la primera.
 */

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
}

export function TeamSection({ status, collaborators, error, onInvited, onRevoke }: TeamSectionProps) {
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
        <h2 className="text-foreground text-lg font-semibold">Colaboradores</h2>

        {status === "loading" ? (
          <p className="text-text-secondary text-sm">Cargando equipo...</p>
        ) : status === "error" ? (
          <p className="text-error text-sm">{error ?? "Error al obtener el equipo."}</p>
        ) : collaborators.length === 0 ? (
          <p className="text-text-secondary text-sm">
            Todavía no otorgaste acceso a ningún colaborador.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {collaborators.map((collaborator) => (
              <CollaboratorRow key={collaborator.id} collaborator={collaborator} onRevoke={onRevoke} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
