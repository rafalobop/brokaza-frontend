/**
 * Tipos + wrapper de `apiClient` para el contrato compartido de MAPPING_FIELDS (KAN-215).
 *
 * Reemplaza el hardcoding que tenía el frontend legacy (`matchouse/src/dashboard/app.js`,
 * constante `MAPPING_FIELDS` duplicada a mano de `excelHeaderMatcher.ts` en el backend —
 * riesgo de divergencia silenciosa documentado en `MIGRATION_PLAN.md` §7). Ahora se consulta
 * `GET /api/upload/mapping-fields` (`matchouse/src/routes/upload.ts`), que expone la misma
 * fuente de verdad (`EXCEL_MAPPING_FIELDS`/`REQUIRED_EXCEL_MAPPING_FIELDS` en
 * `matchouse/src/utils/excelHeaderMatcher.ts`) más una `version` que se bumpea a mano en el
 * backend ante cualquier cambio de esas listas — ver
 * `matchouse/docs/evolucion_proyecto/mapping_fields_contract.md` para el detalle completo del
 * contrato y la regla de versionado.
 */

import { apiClient } from "./api-client";

/** Mismos valores que `ExcelMappingField` en `matchouse/src/utils/excelHeaderMatcher.ts`. */
export type ExcelMappingField =
  | "domicilio"
  | "piso_lote"
  | "precio"
  | "expensas"
  | "dormitorios"
  | "caracteristicas"
  | "contacto"
  | "tipo"
  | "operacion"
  | "latitud"
  | "longitud";

export interface MappingFieldsResponse {
  version: number;
  fields: ExcelMappingField[];
  required: ExcelMappingField[];
}

export function getMappingFields(): Promise<MappingFieldsResponse> {
  return apiClient<MappingFieldsResponse>("/api/upload/mapping-fields");
}
