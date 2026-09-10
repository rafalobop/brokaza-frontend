"use client";

/**
 * Hook `useUpload` (KAN-216/217/218/338) — estado de la subida de un Excel de
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
 * `POST /api/upload/confirm-mapping`; a diferencia de `upload()`, un error de
 * REQUEST (400/500 antes de que el backend acepte el archivo) NO saca al
 * usuario de `needs-mapping` — se queda en el modal con `confirmError`
 * seteado, para que pueda corregir la selección sin perder el archivo ni
 * tener que volver a elegirlo.
 *
 * KAN-338: el resultado final YA NO viene de la respuesta HTTP. El backend
 * responde `{accepted:true}` en cuanto termina de parsear el archivo y
 * validar el plan — ANTES del geocoding real (secuencial, ~1 req/seg contra
 * Nominatim por su política de uso, no paralelizable; puede superar el
 * timeout del cliente en una cartera grande sin coordenadas cacheadas). El
 * resultado real (éxito con el resumen, o error) llega por la misma conexión
 * WS que ya se abría solo para la barra de progreso (`/ws`, reusa
 * `buildMatchCountSocketUrl` — no tiene nada específico de matches pese al
 * nombre), en la etapa `'done'`/`'error'` de `upload_status`
 * (`broadcastUploadStatus`, KAN-137/KAN-338). Por eso el socket ya NO es
 * puramente decorativo: si se cae mientras se espera el resultado (sin haber
 * llegado a 'done'/'error'), `handleSocketClose` degrada a `status: 'error'`
 * en vez de dejar al agente esperando para siempre sin saber si su cartera
 * se cargó.
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
  parseUploadStatusEvent,
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

export interface UseUploadOptions {
  /**
   * KAN-221: se dispara justo después de que la subida (o la confirmación de mapeo) termina con
   * éxito — antes de que el agente tenga que actualizar la página o navegar afuera y volver para
   * ver la cartera recién cargada, el caller (la página de Propiedades) refresca la tabla acá.
   */
  onSuccess?: () => void;
}

export function useUpload(options: UseUploadOptions = {}): UseUploadResult {
  const { onSuccess } = options;
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
  const closeHandlerRef = useRef<(() => void) | null>(null);
  const debouncedSetStageRef = useRef<Debounced<(stage: UploadStage) => void> | null>(null);
  // KAN-338: distingue "cerramos el socket nosotros porque ya llegó 'done'/'error'" de "el socket
  // se cayó solo" — `handleSocketClose` necesita esto para saber si hace falta degradar a error.
  const closingDeliberatelyRef = useRef(false);

  const closeStatusSocket = useCallback(() => {
    closingDeliberatelyRef.current = true;
    debouncedSetStageRef.current?.cancel();
    debouncedSetStageRef.current = null;
    if (socketRef.current) {
      if (messageHandlerRef.current)
        socketRef.current.removeEventListener("message", messageHandlerRef.current);
      if (closeHandlerRef.current)
        socketRef.current.removeEventListener("close", closeHandlerRef.current);
      socketRef.current.close();
    }
    messageHandlerRef.current = null;
    closeHandlerRef.current = null;
    socketRef.current = null;
  }, []);

  const openStatusSocket = useCallback(() => {
    if (typeof window === "undefined") return;

    closingDeliberatelyRef.current = false;

    const debouncedSetStage = debounce(
      (nextStage: UploadStage) => setStage(nextStage),
      UPLOAD_STAGE_DEBOUNCE_MS,
    );
    debouncedSetStageRef.current = debouncedSetStage;

    const socket = new WebSocket(buildMatchCountSocketUrl(window.location));

    const handleMessage = (event: MessageEvent) => {
      const parsed = parseUploadStatusEvent(event.data);
      if (!parsed) return;

      if (parsed.stage === "done") {
        setConfirming(false);
        setPendingSheets([]);
        setPendingFile(null);
        setStatus("success");
        setResult(
          parsed.doneResult
            ? { success: true, ...parsed.doneResult }
            : // Defensivo: un 'done' sin el resultado esperado no debería pasar con el backend
              // real, pero no hay forma de recuperar el detalle si pasa — al menos no se deja al
              // agente esperando para siempre.
              { success: true, count: 0, priceParseErrors: [], loaded: [], failed: [] },
        );
        closeStatusSocket();
        onSuccess?.();
        return;
      }

      if (parsed.stage === "error") {
        setConfirming(false);
        setStatus("error");
        setError(
          "Ocurrió un error al procesar tu cartera. Revisá tu cartera en unos segundos o probá de nuevo.",
        );
        closeStatusSocket();
        return;
      }

      debouncedSetStage(parsed.stage);
    };

    const handleClose = () => {
      if (closingDeliberatelyRef.current) return;
      // El socket se cayó (red, reconexión del navegador, etc.) sin que llegáramos a 'done'/
      // 'error' — a diferencia de antes (KAN-218, cuando el WS era solo decorativo para la barra
      // de progreso), ahora es la ÚNICA vía del resultado final. No podemos dejar al agente
      // esperando para siempre sin saber si su cartera se cargó.
      setConfirming(false);
      setStatus("error");
      setError(
        "Se perdió la conexión en tiempo real mientras se procesaba tu cartera. Revisá tu cartera en unos segundos para confirmar si se cargó.",
      );
    };

    socket.addEventListener("message", handleMessage);
    socket.addEventListener("close", handleClose);
    messageHandlerRef.current = handleMessage;
    closeHandlerRef.current = handleClose;
    socketRef.current = socket;
  }, [closeStatusSocket, onSuccess]);

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
          closeStatusSocket();
          return;
        }
        // KAN-338: `res.accepted === true` — el backend todavía está sincronizando la cartera
        // (geocoding real en curso). Seguimos en "uploading" y dejamos el socket abierto: el
        // resultado final (éxito o error) llega por la etapa 'done'/'error' de `upload_status`
        // (ver `handleMessage` en `openStatusSocket`), no acá.
      } catch (err) {
        const message = err instanceof ApiError ? err.message : "Error al subir el archivo.";
        setStatus("error");
        setError(message);
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
        await confirmColumnMapping(pendingFile, mappings);
        // KAN-338: igual que en `upload()` — la respuesta solo confirma que se aceptó
        // (`{accepted:true}`). Seguimos "confirming" con el socket abierto hasta que llegue
        // 'done'/'error' por WS (`handleMessage` en `openStatusSocket` limpia `confirming` ahí).
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "No se pudo confirmar el mapeo de columnas.";
        setConfirmError(message);
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
