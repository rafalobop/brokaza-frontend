/**
 * Tipos + wrappers de `apiClient` para el módulo de Matches (KAN-189/190).
 *
 * Shapes tomados de `mapBlindMatchRowToDashboardShape` /
 * `mapIncomingMatchRowToDashboardShape` (`matchouse/src/utils/blindMatchPersistence.ts`)
 * — el backend no cambia (§8 de `MIGRATION_PLAN.md`), solo se tipa acá lo que
 * ya devuelven `GET /api/matches` y `GET /api/matches/incoming`. Los 4
 * endpoints de `/api/searches*` los agrega KAN-191 según el layout de
 * archivos de `docs/matches-ui-design.md` §7.
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

/**
 * Contacto congelado del buscador al momento del match (`searcher_snapshot`
 * en el backend) — se completa desde `profiles` en `POST /api/search`, así
 * que cualquier campo puede venir `null` si el buscador nunca lo cargó en su
 * perfil (KAN-64).
 */
export interface IncomingMatchContact {
  full_name: string | null;
  phone_number: string | null;
  agency_name: string | null;
  email: string | null;
}

export interface IncomingMatch {
  id: string;
  fecha: string;
  searchText: string;
  searcherContact: IncomingMatchContact;
  property: MatchProperty;
  reasons: string[];
  score: number;
}

interface IncomingMatchesResponse {
  matches: IncomingMatch[];
}

export function getIncomingMatches(): Promise<IncomingMatchesResponse> {
  return apiClient<IncomingMatchesResponse>("/api/matches/incoming");
}
