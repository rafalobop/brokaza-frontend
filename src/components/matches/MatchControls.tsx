"use client";

/**
 * `MatchControls` (KAN-189) — orden + paginación de "Últimos Matches".
 * Cumple el rol de "filtros/controles" que el AC de KAN-188 pedía como
 * `MatchFiltersContainer` — ver `docs/matches-ui-design.md` §2 para la
 * justificación del rename (no hay filtros de búsqueda reales, solo orden y
 * paginación).
 */

import type { MatchSortOption } from "@/lib/match-sort";

export interface MatchControlsProps {
  sortOption: MatchSortOption;
  onSortChange: (option: MatchSortOption) => void;
  currentPage: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  total: number;
  onPrevPage: () => void;
  onNextPage: () => void;
}

const SORT_OPTIONS: { value: MatchSortOption; label: string }[] = [
  { value: "fecha-desc", label: "Fecha (Recientes primero)" },
  { value: "fecha-asc", label: "Fecha (Antiguos primero)" },
  { value: "score-desc", label: "Score (Mayor primero)" },
  { value: "score-asc", label: "Score (Menor primero)" },
];

export function MatchControls({
  sortOption,
  onSortChange,
  currentPage,
  totalPages,
  startIndex,
  endIndex,
  total,
  onPrevPage,
  onNextPage,
}: MatchControlsProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
        <span>Ordenar por:</span>
        <select
          value={sortOption}
          onChange={(event) => onSortChange(event.target.value as MatchSortOption)}
          className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm text-black dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <div className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-400">
        <span>
          Mostrando {total > 0 ? startIndex + 1 : 0} al {endIndex} de {total} matches
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPrevPage}
            disabled={currentPage <= 1}
            className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium disabled:opacity-40 dark:border-zinc-700"
          >
            Anterior
          </button>
          <span>
            Pág. {currentPage} de {totalPages}
          </span>
          <button
            type="button"
            onClick={onNextPage}
            disabled={currentPage >= totalPages}
            className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium disabled:opacity-40 dark:border-zinc-700"
          >
            Siguiente
          </button>
        </div>
      </div>
    </div>
  );
}
