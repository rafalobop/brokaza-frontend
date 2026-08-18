/**
 * Orden y paginación de la lista de matches (KAN-189) — lógica pura extraída
 * de `loadMatches()` en `matchouse/src/dashboard/app.js` (líneas 988-1043)
 * para poder testearla sin renderizar `MatchesSection`. 100% client-side:
 * `GET /api/matches` ya trae los últimos 50 matches del tenant, el orden y
 * la paginación no pegan a la red.
 */

import type { Match } from "./matches-api";

export type MatchSortOption = "fecha-desc" | "fecha-asc" | "score-desc" | "score-asc";

export function sortMatches(matches: Match[], sortOption: MatchSortOption): Match[] {
  const sorted = [...matches];
  switch (sortOption) {
    case "fecha-desc":
      return sorted; // orden nativo: GET /api/matches ya devuelve created_at desc
    case "fecha-asc":
      return sorted.reverse();
    case "score-desc":
      return sorted.sort((a, b) => b.score - a.score);
    case "score-asc":
      return sorted.sort((a, b) => a.score - b.score);
    default:
      return sorted;
  }
}

export interface PaginatedMatches {
  items: Match[];
  currentPage: number;
  totalPages: number;
  startIndex: number;
  endIndex: number;
  total: number;
}

export function paginateMatches(
  matches: Match[],
  requestedPage: number,
  pageSize: number,
): PaginatedMatches {
  const total = matches.length;
  const totalPages = Math.ceil(total / pageSize) || 1;
  const currentPage = Math.min(Math.max(requestedPage, 1), totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, total);

  return {
    items: matches.slice(startIndex, endIndex),
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    total,
  };
}
