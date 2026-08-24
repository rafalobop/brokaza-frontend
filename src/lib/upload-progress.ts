/**
 * Lógica pura de la barra de progreso real de Upload (KAN-218).
 *
 * El backend (`matchouse/src/services/realtimeHub.ts#broadcastUploadStatus`, KAN-137) empuja al
 * mismo socket `/ws` que ya usa `useRealtimeMatches` (KAN-187/KAN-88) un mensaje
 * `{"type":"upload_status","stage":"..."}` por cada etapa del pipeline de `POST /api/upload`.
 * Antes de este ticket, `MIGRATION_PLAN.md` §7 dejaba pendiente la decisión de consumirlo o
 * descartarlo — este ticket decide consumirlo: son 6 etapas conocidas de antemano (no un
 * porcentaje sintético fila-por-fila), suficiente para una barra de progreso real sin inventar
 * datos que el backend no tiene.
 */

export type UploadStage =
  | "parsing_headers"
  | "resolving_column_mapping"
  | "parsing_rows"
  | "syncing_database"
  | "done"
  | "error";

// Orden real del pipeline (ver comentario de `UploadStatusStage` en `realtimeHub.ts`) — "error" no
// forma parte del avance secuencial, es un estado terminal alternativo a "done".
export const UPLOAD_STAGE_ORDER: Exclude<UploadStage, "error">[] = [
  "parsing_headers",
  "resolving_column_mapping",
  "parsing_rows",
  "syncing_database",
  "done",
];

export const UPLOAD_STAGE_LABELS: Record<UploadStage, string> = {
  parsing_headers: "Leyendo el archivo...",
  resolving_column_mapping: "Resolviendo el mapeo de columnas...",
  parsing_rows: "Procesando las propiedades...",
  syncing_database: "Sincronizando tu cartera...",
  done: "¡Listo!",
  error: "Ocurrió un error durante el procesamiento.",
};

function isUploadStage(value: string): value is UploadStage {
  return value in UPLOAD_STAGE_LABELS;
}

/**
 * Decide si un mensaje entrante del WS es un evento `upload_status` reconocido y devuelve su
 * etapa, o `null` si no aplica (mismo criterio defensivo que `shouldRefetchOnMessage` en
 * `realtime-matches.ts`: nunca lanza, JSON inválido o de otro tipo simplemente se ignora).
 */
export function parseUploadStatusMessage(rawData: unknown): UploadStage | null {
  if (typeof rawData !== "string") return null;
  let payload: unknown;
  try {
    payload = JSON.parse(rawData);
  } catch {
    return null;
  }
  if (!payload || typeof payload !== "object") return null;
  const { type, stage } = payload as { type?: unknown; stage?: unknown };
  if (type !== "upload_status" || typeof stage !== "string" || !isUploadStage(stage)) return null;
  return stage;
}

/** Porcentaje de avance para la barra — "error" se muestra llena (en rojo, a cargo del componente). */
export function uploadStageProgressPercent(stage: UploadStage): number {
  if (stage === "error") return 100;
  const index = UPLOAD_STAGE_ORDER.indexOf(stage);
  if (index === -1) return 0;
  return Math.round(((index + 1) / UPLOAD_STAGE_ORDER.length) * 100);
}

// KAN-218 (AC "debounce apropiado"): las etapas llegan una por una a lo largo de la subida real
// (no es un stream de alta frecuencia), pero un reenvío/reconexión del socket podría entregar dos
// mensajes casi juntos — este debounce (trailing) coalesce ráfagas cortas en una sola actualización
// de estado con la ÚLTIMA etapa recibida, evitando repintar la barra más de lo necesario.
export const UPLOAD_STAGE_DEBOUNCE_MS = 150;

export interface Debounced<T extends (...args: never[]) => void> {
  (...args: Parameters<T>): void;
  cancel: () => void;
}

export function debounce<T extends (...args: never[]) => void>(
  fn: T,
  delayMs: number,
): Debounced<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  const debounced = ((...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn(...args);
    }, delayMs);
  }) as Debounced<T>;

  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };

  return debounced;
}
