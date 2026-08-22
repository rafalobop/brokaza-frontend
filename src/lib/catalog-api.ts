/**
 * Wrapper de `GET /api/catalog` (matchouse/src/routes/upload.ts) — cantidad total de propiedades
 * cargadas por el tenant. El legacy lo usaba para el widget `.inventory-tile`; acá alimenta la
 * card de métrica "Propiedades" del dashboard (Resumen).
 */

import { apiClient } from "./api-client";

export interface CatalogInfo {
  count: number;
}

export function getCatalogInfo(): Promise<CatalogInfo> {
  return apiClient<CatalogInfo>("/api/catalog");
}
