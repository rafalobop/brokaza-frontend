"use client";

/**
 * `ActiveSearchesSection` (KAN-191) — vista "Mis Búsquedas en Curso".
 * Portado de la sección homónima de `matchouse/src/dashboard/index.html`
 * líneas 113-124.
 */

import { useMemo, useState } from "react";
import type { ActiveSearchesStatus } from "@/lib/use-active-searches";
import type { ActiveSearch } from "@/lib/matches-api";
import { Card } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { ActiveSearchItem } from "./ActiveSearchItem";

export interface ActiveSearchesSectionProps {
  status: ActiveSearchesStatus;
  searches: ActiveSearch[];
  error: string | null;
  onArchive: (searchId: string) => Promise<void>;
  onReactivate: (searchId: string) => Promise<void>;
}

type FilterTab = "active" | "expired" | "archived";

const TABS: { key: FilterTab; label: string }[] = [
  { key: "active", label: "Activas" },
  { key: "expired", label: "Vencidas" },
  { key: "archived", label: "Archivadas" },
];

function matchesTab(search: ActiveSearch, tab: FilterTab): boolean {
  if (tab === "archived") return search.status === "matched" || search.status === "cancelled";
  return search.status === tab;
}

export function ActiveSearchesSection({
  status,
  searches,
  error,
  onArchive,
  onReactivate,
}: ActiveSearchesSectionProps) {
  const [tab, setTab] = useState<FilterTab>("active");

  const filteredSearches = useMemo(
    () => searches.filter((search) => matchesTab(search, tab)),
    [searches, tab],
  );

  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-foreground text-lg font-semibold">Mis Búsquedas en Curso</h2>
        <Tabs tabs={TABS} value={tab} onChange={setTab} size="xs" />
      </div>

      {status === "loading" ? (
        <p className="text-text-secondary text-sm">Cargando búsquedas activas...</p>
      ) : status === "error" ? (
        <p className="text-error text-sm">{error ?? "Error al obtener tus búsquedas activas."}</p>
      ) : filteredSearches.length === 0 ? (
        <p className="text-text-secondary text-sm">No hay búsquedas en esta categoría.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {filteredSearches.map((search) => (
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
