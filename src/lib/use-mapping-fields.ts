"use client";

/**
 * Hook `useMappingFields` (KAN-215) — carga el contrato compartido de MAPPING_FIELDS desde
 * `GET /api/upload/mapping-fields` una sola vez al montar. Mismo criterio de estado local (sin
 * store global) que `useMatches`/`useActiveSearches` — no hay mutaciones, solo lectura, así que
 * no expone `refetch` todavía (se agrega si un consumidor futuro lo necesita).
 *
 * Consumido por la UI de mapeo de columnas de Upload (KAN-216/217, todavía no implementada) para
 * no volver a hardcodear la lista de campos del lado del frontend.
 */

import { useEffect, useRef, useState } from "react";
import { ApiError } from "./api-client";
import { getMappingFields, type ExcelMappingField } from "./mapping-fields-api";

export type MappingFieldsStatus = "loading" | "loaded" | "error";

export interface UseMappingFieldsResult {
  status: MappingFieldsStatus;
  version: number | null;
  fields: ExcelMappingField[];
  required: ExcelMappingField[];
  error: string | null;
}

export function useMappingFields(): UseMappingFieldsResult {
  const [status, setStatus] = useState<MappingFieldsStatus>("loading");
  const [version, setVersion] = useState<number | null>(null);
  const [fields, setFields] = useState<ExcelMappingField[]>([]);
  const [required, setRequired] = useState<ExcelMappingField[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Mismo guard que `useMatches`/`useActiveSearches` (KAN-189/191).
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const res = await getMappingFields();
        if (!isMountedRef.current) return;
        setVersion(res.version);
        setFields(res.fields);
        setRequired(res.required);
        setStatus("loaded");
        setError(null);
      } catch (err) {
        if (!isMountedRef.current) return;
        const message =
          err instanceof ApiError
            ? err.message
            : "Error al obtener los campos de mapeo de columnas.";
        setError(message);
        setStatus("error");
      }
    })();
  }, []);

  return { status, version, fields, required, error };
}
