"use client";

/**
 * `ActiveSearchesSection` (KAN-191) — vista "Mis Búsquedas en Curso".
 * Portado de la sección homónima de `matchouse/src/dashboard/index.html`
 * líneas 113-124.
 */

import type { ActiveSearchesStatus } from "@/lib/use-active-searches";
import type { ActiveSearch } from "@/lib/matches-api";
import { Card } from "@/components/ui/Card";
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
    <Card>
      <h2 className="text-foreground text-lg font-semibold">Mis Búsquedas en Curso</h2>

      {status === "loading" ? (
        <p className="text-text-secondary text-sm">Cargando búsquedas activas...</p>
      ) : status === "error" ? (
        <p className="text-error text-sm">{error ?? "Error al obtener tus búsquedas activas."}</p>
      ) : searches.length === 0 ? (
        <p className="text-text-secondary text-sm">No tenés búsquedas activas en este momento.</p>
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
    </Card>
  );
}
