"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/shell/PageHeader";
import { IncomingMatchesSection } from "@/components/matches/IncomingMatchesSection";
import { useMatchesContext } from "@/lib/matches-context";
import { parseHighlightIds } from "@/lib/parse-highlight-param";
import { ONBOARDING_STEP_IDS } from "@/lib/onboarding-tour";

/**
 * Solo "Interesados en tus Propiedades" — decisión de producto: quien busca (agente A) no ve acá
 * los resultados de su propia búsqueda contra la cartera de B. El único que se entera de un
 * match es el dueño de la propiedad (B, esta página), porque es B quien debe contactar a A.
 */
function MatchesPageContent() {
  const { incomingMatches } = useMatchesContext();
  const searchParams = useSearchParams();
  const router = useRouter();

  // KAN-303: captura el/los id(s) a resaltar UNA sola vez desde `?highlight=` (deep-link del push
  // de "interesados en tus propiedades", ver `buildIncomingMatchPushPayload` en el backend) — el
  // inicializador de `useState` corre una sola vez, así que sobrevive a que el query param se
  // limpie de la URL en el efecto de abajo.
  const [highlightIds] = useState<string[]>(() => parseHighlightIds(searchParams.get("highlight")));

  useEffect(() => {
    if (highlightIds.length > 0) {
      router.replace("/matches", { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Matches" description="Quién se interesó en tu cartera." notranslate />
      <div id={ONBOARDING_STEP_IDS.matchesList}>
        <IncomingMatchesSection
          status={incomingMatches.status}
          matches={incomingMatches.matches}
          error={incomingMatches.error}
          highlightIds={highlightIds}
        />
      </div>
    </div>
  );
}

export default function MatchesPage() {
  return (
    <Suspense fallback={null}>
      <MatchesPageContent />
    </Suspense>
  );
}
