/**
 * Tipos + wrapper de `apiClient` para `POST /api/upload` (KAN-216).
 *
 * Shapes tomados de `matchouse/src/routes/upload.ts` (KAN-142) — el backend
 * no cambia, solo se tipa acá lo que ya devuelve. El caso
 * `requiresMappingConfirmation` (KAN-84) es la respuesta 200 que dispara el
 * modal de confirmación de mapeo de columnas (KAN-217, `MappingConfirmModal`).
 */

import { apiClient } from "./api-client";
import type { ExcelMappingField } from "./mapping-fields-api";

export interface UploadPriceParseError {
  sheetName: string;
  address: string;
  rawValue: string;
}

/** Propiedad cargada sin problemas (KAN-220, ver `UploadResultModal`). */
export interface UploadLoadedProperty {
  sheetName: string;
  address: string;
  operation: "venta" | "alquiler";
  price: number;
  currency: "USD" | "ARS";
}

/**
 * Propiedad u hoja que no se cargó completa (KAN-220): une precio no reconocido, geocoding
 * fallido y hojas omitidas por columnas no resueltas en una sola lista con motivo legible.
 * `address` es `null` cuando el fallo es de la hoja entera, no de una fila puntual.
 */
export interface UploadFailureDetail {
  sheetName: string;
  address: string | null;
  reason: string;
}

export interface UploadSuccessResponse {
  success: true;
  count: number;
  priceParseErrors: UploadPriceParseError[];
  loaded: UploadLoadedProperty[];
  failed: UploadFailureDetail[];
}

/**
 * KAN-338: la respuesta HTTP de `POST /api/upload`/`confirm-mapping` ya no trae el resultado
 * final — el backend responde en cuanto termina de parsear el archivo y validar el límite del
 * plan, ANTES del geocoding real (secuencial, ~1 req/seg contra Nominatim, puede tardar más que
 * el timeout del cliente en una cartera grande sin coordenadas cacheadas). El resultado real
 * (mismo shape que `UploadSuccessResponse`, menos `success`) llega por el WS en la etapa `'done'`
 * — ver `upload-progress.ts#UploadDoneResult` y `use-upload.ts`.
 */
export interface UploadAcceptedResponse {
  accepted: true;
  message: string;
}

export interface PendingMappingFieldCandidate {
  header: string;
  confidence: number;
}

export interface PendingMappingField {
  field: ExcelMappingField;
  header: string | null;
  confidence: number;
  ambiguous: boolean;
  candidates: PendingMappingFieldCandidate[];
}

export interface PendingMappingSheet {
  sheetName: string;
  headers: string[];
  headerSignature: string;
  source: "heuristic" | "ai";
  fields: PendingMappingField[];
  unresolvedRequiredFields: ExcelMappingField[];
  ambiguousFields: ExcelMappingField[];
}

export interface UploadNeedsMappingResponse {
  requiresMappingConfirmation: true;
  sheets: PendingMappingSheet[];
}

export type UploadResponse = UploadAcceptedResponse | UploadNeedsMappingResponse;

// El default de `apiClient` (15s) alcanza para la mayoría de los endpoints, pero un Excel
// cerca del límite de tamaño (10MB default en el backend, `uploadMaxFileSizeBytes`) puede
// tardar más entre el parseo en worker thread (KAN-137) y el upsert a Supabase (KAN-5/KAN-71
// AC "cargas grandes sin tiempos de respuesta prolongados" — acá se traduce en no cortar la
// request antes de que el backend termine, no en acelerar el backend).
const UPLOAD_TIMEOUT_MS = 60_000;

export function uploadExcelFile(file: File): Promise<UploadResponse> {
  const formData = new FormData();
  formData.append("excelFile", file);
  return apiClient<UploadResponse>("/api/upload", {
    method: "POST",
    body: formData,
    timeoutMs: UPLOAD_TIMEOUT_MS,
    logTag: "[UPLOAD]",
  });
}

/** Mapeo de columnas confirmado/corregido por el agente, una entrada por hoja pendiente (KAN-217). */
export type SheetMappingSelections = Record<
  string,
  Partial<Record<ExcelMappingField, string | null>>
>;

/**
 * `POST /api/upload/confirm-mapping` (KAN-84/KAN-217) — reenvía el mismo archivo más el mapeo
 * final elegido por el agente. Responde igual que `uploadExcelFile` en éxito (nunca vuelve a
 * pedir confirmación: si el mapeo confirmado no resuelve los campos requeridos de alguna hoja,
 * el backend responde 400, que `apiClient` ya convierte en `ApiError`).
 */
export function confirmColumnMapping(
  file: File,
  mappings: SheetMappingSelections,
): Promise<UploadAcceptedResponse> {
  const formData = new FormData();
  formData.append("excelFile", file);
  formData.append("mappings", JSON.stringify(mappings));
  return apiClient<UploadAcceptedResponse>("/api/upload/confirm-mapping", {
    method: "POST",
    body: formData,
    timeoutMs: UPLOAD_TIMEOUT_MS,
    logTag: "[UPLOAD]",
  });
}
