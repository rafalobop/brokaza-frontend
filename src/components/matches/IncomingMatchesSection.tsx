"use client";

/**
 * `IncomingMatchesSection` (KAN-190) — vista "Interesados en tus
 * Propiedades", solo lectura. Portado de la sección homónima de
 * `matchouse/src/dashboard/index.html` líneas 167-181.
 */

import type { IncomingMatch } from "@/lib/matches-api";
import type { IncomingMatchesStatus } from "@/lib/use-incoming-matches";
import { IncomingMatchItem } from "./IncomingMatchItem";

export interface IncomingMatchesSectionProps {
  status: IncomingMatchesStatus;
  matches: IncomingMatch[];
  error: string | null;
}

export function IncomingMatchesSection({ status, matches, error }: IncomingMatchesSectionProps) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-black dark:text-zinc-50">
          Interesados en tus Propiedades
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Cuando un agente busca algo que coincide con una de tus propiedades, aparece acá con sus
          datos de contacto.
        </p>
      </div>

      {status === "loading" ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Cargando interesados en tus propiedades...
        </p>
      ) : status === "error" ? (
        <p className="text-sm text-red-600 dark:text-red-400">
          {error ?? "Error al obtener los interesados en tus propiedades."}
        </p>
      ) : matches.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Todavía nadie buscó ninguna de tus propiedades.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {matches.map((match) => (
            <IncomingMatchItem key={match.id} match={match} />
          ))}
        </div>
      )}
    </section>
  );
}
