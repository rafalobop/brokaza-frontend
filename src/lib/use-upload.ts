"use client";

/**
 * Hook `useUpload` (KAN-216/217) — estado de la subida de un Excel de
 * cartera: `idle` -> `uploading` -> `success` | `error` | `needs-mapping`.
 *
 * Validación de extensión client-side (mismo criterio que el legacy,
 * `matchouse/src/dashboard/app.js#handleFileUpload`: solo `.xlsx`, sin
 * chequeo de tamaño en el cliente — el tamaño lo valida el backend
 * (multer `limits.fileSize`) y devuelve 413 con un mensaje ya armado con el
 * límite real configurado, evitar duplicar ese número acá es intencional
 * (mismo motivo que KAN-215: no hardcodear un valor que vive en el backend).
 *
 * `needs-mapping` (KAN-84 `requiresMappingConfirmation`) es el estado que
 * dispara el modal de confirmación de mapeo (KAN-217, `MappingConfirmModal`).
 * `confirmMapping()` reenvía el mismo `File` (guardado en `pendingFile` al
 * entrar a `needs-mapping`) junto con la selección del agente a
 * `POST /api/upload/confirm-mapping`; a diferencia de `upload()`, un error acá
 * NO saca al usuario de `needs-mapping` — se queda en el modal con
 * `confirmError` seteado, para que pueda corregir la selección sin perder el
 * archivo ni tener que volver a elegirlo.
 */

import { useCallback, useState } from "react";
import { ApiError } from "./api-client";
import {
  confirmColumnMapping,
  uploadExcelFile,
  type PendingMappingSheet,
  type SheetMappingSelections,
  type UploadSuccessResponse,
} from "./upload-api";

const ALLOWED_EXTENSION = ".xlsx";

export type UploadStatus = "idle" | "uploading" | "success" | "error" | "needs-mapping";

export interface UseUploadResult {
  status: UploadStatus;
  error: string | null;
  result: UploadSuccessResponse | null;
  pendingSheets: PendingMappingSheet[];
  confirming: boolean;
  confirmError: string | null;
  upload: (file: File) => Promise<void>;
  confirmMapping: (mappings: SheetMappingSelections) => Promise<void>;
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
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const upload = useCallback(async (file: File) => {
    const validationError = validateExtension(file);
    if (validationError) {
      setStatus("error");
      setError(validationError);
      setResult(null);
      setPendingSheets([]);
      setPendingFile(null);
      return;
    }

    setStatus("uploading");
    setError(null);
    setResult(null);
    setPendingSheets([]);
    setPendingFile(null);
    setConfirmError(null);

    try {
      const res = await uploadExcelFile(file);
      if ("requiresMappingConfirmation" in res) {
        setStatus("needs-mapping");
        setPendingSheets(res.sheets);
        setPendingFile(file);
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

  const confirmMapping = useCallback(
    async (mappings: SheetMappingSelections) => {
      if (!pendingFile) return;

      setConfirming(true);
      setConfirmError(null);
      try {
        const res = await confirmColumnMapping(pendingFile, mappings);
        setStatus("success");
        setResult(res);
        setPendingSheets([]);
        setPendingFile(null);
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "No se pudo confirmar el mapeo de columnas.";
        setConfirmError(message);
      } finally {
        setConfirming(false);
      }
    },
    [pendingFile],
  );

  const reset = useCallback(() => {
    setStatus("idle");
    setError(null);
    setResult(null);
    setPendingSheets([]);
    setPendingFile(null);
    setConfirming(false);
    setConfirmError(null);
  }, []);

  return {
    status,
    error,
    result,
    pendingSheets,
    confirming,
    confirmError,
    upload,
    confirmMapping,
    reset,
  };
}
