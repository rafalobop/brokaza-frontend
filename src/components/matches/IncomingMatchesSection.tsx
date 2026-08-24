"use client";

/**
 * `IncomingMatchesSection` (KAN-190) — vista "Interesados en tus
 * Propiedades", solo lectura. Portado de la sección homónima de
 * `matchouse/src/dashboard/index.html` líneas 167-181.
 */

import type { IncomingMatch } from "@/lib/matches-api";
import type { IncomingMatchesStatus } from "@/lib/use-incoming-matches";
import { Card } from "@/components/ui/Card";
import { IncomingMatchItem } from "./IncomingMatchItem";

export interface IncomingMatchesSectionProps {
  status: IncomingMatchesStatus;
  matches: IncomingMatch[];
  error: string | null;
}

export function IncomingMatchesSection({ status, matches, error }: IncomingMatchesSectionProps) {
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
            <IncomingMatchItem key={match.id} match={match} />
          ))}
        </div>
      )}
    </Card>
  );
}
