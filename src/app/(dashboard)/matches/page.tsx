"use client";

import { PageHeader } from "@/components/shell/PageHeader";
import { IncomingMatchesSection } from "@/components/matches/IncomingMatchesSection";
import { useMatchesContext } from "@/lib/matches-context";

/**
 * Solo "Interesados en tus Propiedades" — decisión de producto: quien busca (agente A) no ve acá
 * los resultados de su propia búsqueda contra la cartera de B. El único que se entera de un
 * match es el dueño de la propiedad (B, esta página), porque es B quien debe contactar a A.
 */
export default function MatchesPage() {
  const { incomingMatches } = useMatchesContext();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Matches" description="Quién se interesó en tu cartera." />
      <IncomingMatchesSection
        status={incomingMatches.status}
        matches={incomingMatches.matches}
        error={incomingMatches.error}
      />
    </div>
  );
}
