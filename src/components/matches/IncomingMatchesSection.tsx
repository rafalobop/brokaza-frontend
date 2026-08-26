"use client";

/**
 * `IncomingMatchesSection` (KAN-190) — vista "Interesados en tus
 * Propiedades", solo lectura. Portado de la sección homónima de
 * `matchouse/src/dashboard/index.html` líneas 167-181.
 */

import { useEffect, useRef } from "react";
import type { IncomingMatch } from "@/lib/matches-api";
import type { IncomingMatchesStatus } from "@/lib/use-incoming-matches";
import { Card } from "@/components/ui/Card";
import { IncomingMatchItem } from "./IncomingMatchItem";

export interface IncomingMatchesSectionProps {
  status: IncomingMatchesStatus;
  matches: IncomingMatch[];
  error: string | null;
  /** KAN-303: ids de `blind_matches` a resaltar, del deep-link `?highlight=` (ver `MatchesPage`). */
  highlightIds?: string[];
}

export function IncomingMatchesSection({
  status,
  matches,
  error,
  highlightIds = [],
}: IncomingMatchesSectionProps) {
  // Hace scroll al primer match resaltado una sola vez, cuando ya está renderizado en el DOM (no
  // antes de que `matches` cargue) — mismo criterio de "una sola vez" que el `useEffect` de
  // `IncomingMatchItem` que abre el acordeón.
  const scrolledRef = useRef(false);
  useEffect(() => {
    if (scrolledRef.current || status !== "loaded" || highlightIds.length === 0) return;
    const firstMatch = matches.find((m) => highlightIds.includes(m.id));
    if (!firstMatch) return;
    scrolledRef.current = true;
    // `?.scrollIntoView?.(...)` (no solo el elemento): jsdom (entorno de test) no implementa este
    // método — sin el segundo `?.` un test rompería con "scrollIntoView is not a function".
    document.getElementById(`incoming-match-${firstMatch.id}`)?.scrollIntoView?.({
      behavior: "smooth",
      block: "center",
    });
  }, [status, matches, highlightIds]);

  return (
    <Card>
      <div className="flex flex-col gap-1">
        <h2 className="text-foreground text-lg font-semibold">Interesados en tus Propiedades</h2>
        <p className="text-text-secondary text-sm">
          Cuando un agente busca algo que coincide con una de tus propiedades, aparece acá con sus
          datos de contacto.
        </p>
      </div>

      {status === "loading" ? (
        <p className="text-text-secondary text-sm">Cargando interesados en tus propiedades...</p>
      ) : status === "error" ? (
        <p className="text-error text-sm">
          {error ?? "Error al obtener los interesados en tus propiedades."}
        </p>
      ) : matches.length === 0 ? (
        <p className="text-text-secondary text-sm">
          Todavía nadie buscó ninguna de tus propiedades.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {matches.map((match) => (
            <IncomingMatchItem
              key={match.id}
              match={match}
              highlighted={highlightIds.includes(match.id)}
            />
          ))}
        </div>
      )}
    </Card>
  );
}
