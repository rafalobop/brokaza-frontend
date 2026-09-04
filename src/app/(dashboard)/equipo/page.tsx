"use client";

import { PageHeader } from "@/components/shell/PageHeader";
import { TeamSection } from "@/components/team/TeamSection";
import { useTeam } from "@/lib/use-team";

export default function EquipoPage() {
  const { status, collaborators, error, refetch, revoke, reactivate } = useTeam();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Equipo"
        description="Otorgá y revocá el acceso de tus colaboradores a la agencia."
      />
      <TeamSection
        status={status}
        collaborators={collaborators}
        error={error}
        onInvited={() => void refetch()}
        onRevoke={revoke}
        onReactivate={reactivate}
      />
    </div>
  );
}
