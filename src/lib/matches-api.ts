/**
 * Tipos + wrappers de `apiClient` para el módulo de Matches (KAN-189).
 *
 * Shape de `Match` tomado de `mapBlindMatchRowToDashboardShape`
 * (`matchouse/src/utils/blindMatchPersistence.ts`) — el backend no cambia
 * (§8 de `MIGRATION_PLAN.md`), solo se tipa acá lo que ya devuelve
 * `GET /api/matches`. Alcance de este archivo: solo los 2 endpoints que usa
 * la vista "Últimos Matches" (KAN-189). Los otros 4 endpoints del módulo
 * (`/api/matches/incoming`, `/api/searches*`) los agregan KAN-190/191 según
 * el layout de archivos de `docs/matches-ui-design.md` §7.
 */

import { apiClient } from "./api-client";

export interface MatchProperty {
  domicilio: string;
  precio: number;
  moneda: string;
  operacion: string;
}

export type MatchReviewStatus = "PENDING" | "ACCEPTED" | "REJECTED";

export interface Match {
  id: string;
  fecha: string;
  searchText: string;
  property: MatchProperty;
  reasons: string[];
  score: number;
  userReviewStatus: MatchReviewStatus;
  feedbackReason: string | null;
}

interface MatchesResponse {
  matches: Match[];
}

export function getMatches(): Promise<MatchesResponse> {
  return apiClient<MatchesResponse>("/api/matches");
}

export function sendMatchFeedback(
  matchId: string,
  status: Extract<MatchReviewStatus, "ACCEPTED" | "REJECTED">,
  reason: string | null = null,
): Promise<{ success: true }> {
  return apiClient<{ success: true }>(`/api/matches/${matchId}/feedback`, {
    method: "POST",
    body: JSON.stringify({ status, reason }),
  });
}
