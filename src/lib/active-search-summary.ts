/**
 * Resumen legible de los criterios de una búsqueda activa (KAN-191), port
 * 1:1 de `buildSearchSummary`/`SEARCH_STATUS_LABELS`/`OPERATION_LABELS` en
 * `matchouse/src/dashboard/app.js` (líneas 1233-1266).
 */

import type { ActiveSearchCriteria, ActiveSearchStatus } from "./matches-api";

export const SEARCH_STATUS_LABELS: Record<ActiveSearchStatus, string> = {
  active: "Activa",
  expired: "Vencida",
  matched: "Archivada",
  cancelled: "Archivada",
};

const OPERATION_LABELS: Record<string, string> = {
  venta: "Venta",
  alquiler: "Alquiler",
  desconocido: "Operación sin especificar",
};

export function buildSearchSummary(criteria: ActiveSearchCriteria | null): string {
  if (!criteria) return "Búsqueda sin criterios detectados.";

  const parts: string[] = [];
  parts.push(
    (criteria.operation && OPERATION_LABELS[criteria.operation]) || "Operación sin especificar",
  );

  if (criteria.property_type) parts.push(criteria.property_type);
  if (Array.isArray(criteria.zones) && criteria.zones.length > 0) {
    parts.push(`en ${criteria.zones.join(", ")}`);
  }
  if (criteria.bedrooms) parts.push(`${criteria.bedrooms} dorm.`);
  if (criteria.max_budget && criteria.currency && criteria.currency !== "desconocido") {
    parts.push(`hasta ${criteria.currency} ${criteria.max_budget}`);
  }

  return parts.join(" · ");
}
