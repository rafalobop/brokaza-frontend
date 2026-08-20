/**
 * Tipos + wrapper de `adminApiClient` para `GET /api/properties` (KAN-240).
 *
 * Shape tomado de `matchouse/src/adminRoutes.ts` (KAN-130) — el backend no cambia, solo se tipa
 * acá lo que ya devuelve. `pageSize` (50, `PROPERTIES_PAGE_SIZE`) lo decide el backend; el
 * frontend no lo hardcodea para calcular totalPages, lo usa tal cual viene en la respuesta.
 */

import { adminApiClient } from "./admin-api-client";

export interface PropertyZone {
  id: string;
  name: string;
  group_id: string | null;
}

export type PropertyZoneSource = "point" | "text" | "none";

export interface AdminProperty {
  id: string;
  address: string;
  latitude: number;
  longitude: number;
  zone: PropertyZone | null;
  zoneSource: PropertyZoneSource;
  textSuggestedZone: PropertyZone | null;
  hasDiscrepancy: boolean;
}

export interface PropertiesResponse {
  properties: AdminProperty[];
  page: number;
  pageSize: number;
  total: number;
}

export interface GetPropertiesParams {
  page?: number;
  search?: string;
}

export function getProperties({
  page = 1,
  search,
}: GetPropertiesParams = {}): Promise<PropertiesResponse> {
  const params = new URLSearchParams({ page: String(page) });
  if (search) params.set("search", search);
  return adminApiClient<PropertiesResponse>(`/api/properties?${params.toString()}`);
}
