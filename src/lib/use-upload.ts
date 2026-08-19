"use client";

/**
 * Hook `useUpload` (KAN-216/217/218) — estado de la subida de un Excel de
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
 *
 * `stage` (KAN-218) es puramente decorativo: mientras `upload()`/`confirmMapping()`
 * están en curso, abre una conexión WS a `/ws` (mismo endpoint que
 * `useRealtimeMatches`, KAN-187/KAN-88 — se reusa `buildMatchCountSocketUrl`,
 * que no tiene nada específico de matches pese al nombre, solo arma la URL)
 * y escucha los eventos `upload_status` que emite el backend
 * (`broadcastUploadStatus`, KAN-137) durante el pipeline real de
 * `POST /api/upload`/`confirm-mapping`. El resultado final (éxito/error/
 * needs-mapping) sigue viniendo 100% de la respuesta HTTP, nunca del WS — si
 * el socket no conecta o se cae, la subida igual termina normalmente, solo
 * sin barra de progreso intermedia.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "./api-client";
import { buildMatchCountSocketUrl } from "./realtime-matches";
import {
  confirmColumnMapping,
  uploadExcelFile,
  type PendingMappingSheet,
  type SheetMappingSelections,
  type UploadSuccessResponse,
} from "./upload-api";
import {
  debounce,
  parseUploadStatusMessage,
  UPLOAD_STAGE_DEBOUNCE_MS,
  type Debounced,
  type UploadStage,
} from "./upload-progress";

const ALLOWED_EXTENSION = ".xlsx";

export type UploadStatus = "idle" | "uploading" | "success" | "error" | "needs-mapping";

export interface UseUploadResult {
  status: UploadStatus;
  error: string | null;
  result: UploadSuccessResponse | null;
  pendingSheets: PendingMappingSheet[];
  confirming: boolean;
  confirmError: string | null;
  stage: UploadStage | null;
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
  const [stage, setStage] = useState<UploadStage | null>(null);

  const socketRef = useRef<WebSocket | null>(null);
  const messageHandlerRef = useRef<((event: MessageEvent) => void) | null>(null);
  const debouncedSetStageRef = useRef<Debounced<(stage: UploadStage) => void> | null>(null);

  const closeStatusSocket = useCallback(() => {
    debouncedSetStageRef.current?.cancel();
    debouncedSetStageRef.current = null;
    if (socketRef.current && messageHandlerRef.current) {
      socketRef.current.removeEventListener("message", messageHandlerRef.current);
    }
    messageHandlerRef.current = null;
    socketRef.current?.close();
    socketRef.current = null;
  }, []);

  const openStatusSocket = useCallback(() => {
    if (typeof window === "undefined") return;

    const debouncedSetStage = debounce((nextStage: UploadStage) => setStage(nextStage), UPLOAD_STAGE_DEBOUNCE_MS);
    debouncedSetStageRef.current = debouncedSetStage;

    const socket = new WebSocket(buildMatchCountSocketUrl(window.location));
    const handleMessage = (event: MessageEvent) => {
      const nextStage = parseUploadStatusMessage(event.data);
      if (nextStage) debouncedSetStage(nextStage);
    };
    socket.addEventListener("message", handleMessage);
    messageHandlerRef.current = handleMessage;
    socketRef.current = socket;
  }, []);

  // Cierre de red de seguridad si el componente se desmonta con una subida en curso.
  useEffect(() => {
    return () => {
      closeStatusSocket();
    };
  }, [closeStatusSocket]);

  const upload = useCallback(
    async (file: File) => {
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
      setStage(null);
      openStatusSocket();

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
      } finally {
        closeStatusSocket();
      }
    },
    [openStatusSocket, closeStatusSocket],
  );

  const confirmMapping = useCallback(
    async (mappings: SheetMappingSelections) => {
      if (!pendingFile) return;

      setConfirming(true);
      setConfirmError(null);
      setStage(null);
      openStatusSocket();

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
        closeStatusSocket();
      }
    },
    [pendingFile, openStatusSocket, closeStatusSocket],
  );

  const reset = useCallback(() => {
    closeStatusSocket();
    setStatus("idle");
    setError(null);
    setResult(null);
    setPendingSheets([]);
    setPendingFile(null);
    setConfirming(false);
    setConfirmError(null);
    setStage(null);
  }, [closeStatusSocket]);

  return {
    status,
    error,
    result,
    pendingSheets,
    confirming,
    confirmError,
    stage,
    upload,
    confirmMapping,
    reset,
  };
}
