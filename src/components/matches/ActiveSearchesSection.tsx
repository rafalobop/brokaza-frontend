"use client";

/**
 * `ActiveSearchesSection` (KAN-191) — vista "Mis Búsquedas en Curso".
 * Portado de la sección homónima de `matchouse/src/dashboard/index.html`
 * líneas 113-124.
 */

import type { ActiveSearchesStatus } from "@/lib/use-active-searches";
import type { ActiveSearch } from "@/lib/matches-api";
import { ActiveSearchItem } from "./ActiveSearchItem";

export interface ActiveSearchesSectionProps {
  status: ActiveSearchesStatus;
  searches: ActiveSearch[];
  error: string | null;
  onArchive: (searchId: string) => Promise<void>;
  onReactivate: (searchId: string) => Promise<void>;
}

export function ActiveSearchesSection({
  status,
  searches,
  error,
  onArchive,
  onReactivate,
}: ActiveSearchesSectionProps) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="text-lg font-semibold text-black dark:text-zinc-50">Mis Búsquedas en Curso</h2>

      {status === "loading" ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Cargando búsquedas activas...</p>
      ) : status === "error" ? (
        <p className="text-sm text-red-600 dark:text-red-400">
          {error ?? "Error al obtener tus búsquedas activas."}
        </p>
      ) : searches.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No tenés búsquedas activas en este momento.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {searches.map((search) => (
            <ActiveSearchItem
              key={search.id}
              search={search}
              onArchive={onArchive}
              onReactivate={onReactivate}
            />
          ))}
        </div>
      )}
    </section>
  );
}
