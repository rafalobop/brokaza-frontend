/**
 * Tipos + wrappers de `apiClient` para el módulo de Matches (KAN-190/191).
 *
 * Shape de `IncomingMatch` tomado de `mapIncomingMatchRowToDashboardShape`; shape de
 * `ActiveSearch` tomado directamente de `matchouse/src/routes/search.ts` (`GET /api/searches`,
 * líneas 291-302). El backend no cambia (§8 de `MIGRATION_PLAN.md`), solo se tipa acá lo que ya
 * devuelve.
 *
 * No hay tipos/wrappers para `GET /api/matches` ni `POST /api/matches/:id/feedback` (los
 * resultados de las propias búsquedas de un tenant contra la cartera de otros) — decisión de
 * producto: quien debe enterarse de un match y contactar es el dueño de la propiedad (el que ve
 * `IncomingMatch`/"Interesados en tus Propiedades"), no el que buscó. El endpoint del backend
 * sigue existiendo, simplemente no se consume desde acá.
 */

import { apiClient } from "./api-client";

export interface MatchProperty {
  domicilio: string;
  precio: number;
  moneda: string;
  operacion: string;
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

export type ActiveSearchStatus = "active" | "expired";

/**
 * Subset de `ExtractedRealEstateRequest` (backend, `services/ai.ts`) que
 * efectivamente consume la UI (`buildSearchSummary` en el legacy,
 * `matchouse/src/dashboard/app.js` líneas 1252-1266) — el objeto real trae
 * más campos (`dormitorios_min`, `caracteristicas_claves`, etc.) que ninguna
 * vista usa todavía.
 */
export interface ActiveSearchCriteria {
  operation?: string;
  property_type?: string;
  zones?: string[];
  bedrooms?: number;
  max_budget?: number;
  currency?: string;
}

export interface ActiveSearch {
  id: string;
  raw_text: string;
  criteria: ActiveSearchCriteria | null;
  status: ActiveSearchStatus;
  created_at: string;
  expires_at: string;
  days_remaining: number;
  matches_count: number;
}

interface ActiveSearchesResponse {
  searches: ActiveSearch[];
}

export function getActiveSearches(): Promise<ActiveSearchesResponse> {
  return apiClient<ActiveSearchesResponse>("/api/searches");
}

/**
 * `POST /api/search` puede segmentar un mismo texto en varias búsquedas
 * (Agente 0, backend) y solo devuelve un status 2xx cuando al menos un
 * segmento tuvo éxito (`allFailed` en el backend fuerza 500/504) — el
 * legacy (`app.js` líneas 1300-1338) no distingue ese detalle, solo mira
 * `res.ok`/`data.error` para el mensaje genérico de éxito o error. `apiClient`
 * ya convierte cualquier respuesta no-2xx en un `ApiError` con `message`
 * tomado de `body.error`, así que acá no hace falta modelar el caso de
 * error — solo la forma del body en éxito (`success` siempre `true` en 2xx).
 * Se ignora el detalle de segmentación (`segmented`/`searches`), que ninguna
 * vista consume todavía.
 */
export interface SubmitSearchResponse {
  success: true;
}

export function submitSearch(text: string): Promise<SubmitSearchResponse> {
  return apiClient<SubmitSearchResponse>("/api/search", {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export function archiveActiveSearch(searchId: string): Promise<{ success: true }> {
  return apiClient<{ success: true }>(`/api/searches/${searchId}`, { method: "DELETE" });
}

export function reactivateActiveSearch(
  searchId: string,
): Promise<{ success: true; expires_at: string }> {
  return apiClient<{ success: true; expires_at: string }>(`/api/searches/${searchId}/reactivate`, {
    method: "POST",
  });
}
