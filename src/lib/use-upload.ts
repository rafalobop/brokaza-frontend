"use client";

/**
 * Hook `useUpload` (KAN-216) — estado de la subida de un Excel de cartera:
 * `idle` -> `uploading` -> `success` | `error` | `needs-mapping`.
 *
 * Validación de extensión client-side (mismo criterio que el legacy,
 * `matchouse/src/dashboard/app.js#handleFileUpload`: solo `.xlsx`, sin
 * chequeo de tamaño en el cliente — el tamaño lo valida el backend
 * (multer `limits.fileSize`) y devuelve 413 con un mensaje ya armado con el
 * límite real configurado, evitar duplicar ese número acá es intencional
 * (mismo motivo que KAN-215: no hardcodear un valor que vive en el backend).
 *
 * `needs-mapping` (KAN-84 `requiresMappingConfirmation`) queda expuesto acá
 * para que el componente pueda mostrar que hace falta confirmar el mapeo,
 * pero la UI del modal de confirmación es KAN-217 — fuera de alcance de
 * este ticket.
 */

import { useCallback, useState } from "react";
import { ApiError } from "./api-client";
import { uploadExcelFile, type PendingMappingSheet, type UploadSuccessResponse } from "./upload-api";

const ALLOWED_EXTENSION = ".xlsx";

export type UploadStatus = "idle" | "uploading" | "success" | "error" | "needs-mapping";

export interface UseUploadResult {
  status: UploadStatus;
  error: string | null;
  result: UploadSuccessResponse | null;
  pendingSheets: PendingMappingSheet[];
  upload: (file: File) => Promise<void>;
  reset: () => void;
}

function validateExtension(file: File): string | null {
  if (!file.name.toLowerCase().endsWith(ALLOWED_EXTENSION)) {
    return `Solo se permiten archivos Excel (${ALLOWED_EXTENSION}).`;
  }
  return null;
}

export function useUpload(): UseUploadResult {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<UploadSuccessResponse | null>(null);
  const [pendingSheets, setPendingSheets] = useState<PendingMappingSheet[]>([]);

  const upload = useCallback(async (file: File) => {
    const validationError = validateExtension(file);
    if (validationError) {
      setStatus("error");
      setError(validationError);
      setResult(null);
      setPendingSheets([]);
      return;
    }

    setStatus("uploading");
    setError(null);
    setResult(null);
    setPendingSheets([]);

    try {
      const res = await uploadExcelFile(file);
      if ("requiresMappingConfirmation" in res) {
        setStatus("needs-mapping");
        setPendingSheets(res.sheets);
        return;
      }
      setStatus("success");
      setResult(res);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Error al subir el archivo.";
      setStatus("error");
      setError(message);
    }
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setResult(null);
    setPendingSheets([]);
  }, []);

  return { status, error, result, pendingSheets, upload, reset };
}
