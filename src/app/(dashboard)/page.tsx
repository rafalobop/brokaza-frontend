"use client";

import { Building2, ChevronRight, Heart, Search } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { LinkCard } from "@/components/ui/LinkCard";
import { MetricCard } from "@/components/ui/MetricCard";
import { NewSearchForm } from "@/components/matches/NewSearchForm";
import { useCatalogCount } from "@/lib/use-catalog-count";
import { useMatchesContext } from "@/lib/matches-context";

/**
 * Resumen (`/`) — página home del dashboard: cards de métrica (row_1 del brief) + previews
 * compactas que linkean a sus páginas completas (`/matches`, `/busquedas`). Todos los números
 * son reales (catálogo, `MatchesProvider`), ninguno placeholder. Cada card (métrica o preview)
 * es clickeable — redirige entera a su página, no solo un link "Ver todos" suelto adentro.
 *
 * Sin card de "Matches" (resultados de las propias búsquedas del tenant) — decisión de producto,
 * ver comentario en `matches-api.ts`: ese dato no se muestra en ningún lado del frontend.
 */
export default function ResumenPage() {
  const catalog = useCatalogCount();
  const { incomingMatches, activeSearches } = useMatchesContext();

  const activeCount = activeSearches.searches.filter((s) => s.status === "active").length;
  // Excluye archivadas ('matched'/'cancelled') del preview — son historial, no "en curso" (GET
  // /api/searches ahora las trae para que /busquedas pueda filtrarlas, ver ActiveSearchesSection).
  const ongoingSearches = activeSearches.searches.filter(
    (s) => s.status === "active" || s.status === "expired",
  );

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Resumen"
        description="Estado general de tu cartera, búsquedas activas e interesados."
      />

      <NewSearchForm onSubmitted={() => void activeSearches.refetch()} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <MetricCard
          label="Propiedades"
          value={catalog.status === "loading" ? "…" : catalog.count}
          icon={Building2}
          href="/propiedades"
        />
        <MetricCard
          label="Búsquedas activas"
          value={activeSearches.status === "loading" ? "…" : activeCount}
          icon={Search}
          href="/busquedas"
        />
        <MetricCard
          label="Interesados en tus propiedades"
          value={incomingMatches.status === "loading" ? "…" : incomingMatches.matches.length}
          icon={Heart}
          href="/matches"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <LinkCard href="/busquedas">
          <div className="flex items-center justify-between">
            <h2 className="text-foreground text-base font-semibold">Búsquedas en curso</h2>
            <ChevronRight className="text-text-secondary h-4 w-4" aria-hidden="true" />
          </div>
          {ongoingSearches.length === 0 ? (
            <p className="text-text-secondary text-sm">Todavía no cargaste ninguna búsqueda.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {ongoingSearches.slice(0, 4).map((search) => (
                <li
                  key={search.id}
                  className="rounded-radius-sm bg-card flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <span className="text-foreground truncate">{search.raw_text}</span>
                  <span className="text-text-secondary shrink-0 text-xs">
                    {search.matches_count} match{search.matches_count === 1 ? "" : "es"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </LinkCard>

        <LinkCard href="/matches">
          <div className="flex items-center justify-between">
            <h2 className="text-foreground text-base font-semibold">Últimos interesados</h2>
            <ChevronRight className="text-text-secondary h-4 w-4" aria-hidden="true" />
          </div>
          {incomingMatches.matches.length === 0 ? (
            <p className="text-text-secondary text-sm">Todavía nadie se interesó en tu cartera.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {incomingMatches.matches.slice(0, 4).map((match) => (
                <li
                  key={match.id}
                  className="rounded-radius-sm bg-card flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <span className="text-foreground truncate">{match.property.domicilio}</span>
                  <span className="text-text-secondary shrink-0 text-xs">{match.score}%</span>
                </li>
              ))}
            </ul>
          )}
        </LinkCard>
      </div>
    </div>
  );
}
