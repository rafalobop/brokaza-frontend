"use client";

import { PageHeader } from "@/components/shell/PageHeader";
import { ActiveSearchesSection } from "@/components/matches/ActiveSearchesSection";
import { NewSearchForm } from "@/components/matches/NewSearchForm";
import { useMatchesContext } from "@/lib/matches-context";
import { ONBOARDING_STEP_IDS } from "@/lib/onboarding-tour";

export default function BusquedasPage() {
  const { activeSearches } = useMatchesContext();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Búsquedas activas"
        description="Pedidos de tus clientes cruzados automáticamente contra la cartera de otros agentes."
      />
      <div id={ONBOARDING_STEP_IDS.busquedasForm}>
        <NewSearchForm onSubmitted={() => void activeSearches.refetch()} />
      </div>
      <div id={ONBOARDING_STEP_IDS.busquedasList}>
        <ActiveSearchesSection
          status={activeSearches.status}
          searches={activeSearches.searches}
          error={activeSearches.error}
          onArchive={activeSearches.archive}
          onReactivate={activeSearches.reactivate}
        />
      </div>
    </div>
  );
}
