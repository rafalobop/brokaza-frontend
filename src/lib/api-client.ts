/**
 * Cliente de API unificado (KAN-155).
 *
 * Reemplaza los dos wrappers de `fetch` duplicados y con semántica distinta
 * que hoy conviven en el frontend legacy de matchouse:
 *
 * - `fetchWithTimeout` (src/dashboard/app.js): aborta con `AbortController`
 *   pasado un timeout, loguea el motivo real del fallo (timeout vs. red vs.
 *   HTTP) con un `logTag`, y devuelve el `Response` crudo — el caller decide
 *   `res.ok` / `res.json()`.
 * - `apiFetch` (src/admin-dashboard/app.js): fuerza
 *   `Content-Type: application/json`, parsea el body como JSON de forma
 *   tolerante (una respuesta sin body no rompe), y ya tira una excepción si
 *   `!res.ok` usando `body.error` (o `Error <status>` como fallback).
 *
 * `apiClient` adopta la semántica de `apiFetch` (parsear y lanzar en vez de
 * devolver `Response` crudo) porque es la más cómoda para código con
 * try/catch, y le suma encima el timeout/abort + logging de
 * `fetchWithTimeout`. El status y el body parseado quedan disponibles en
 * `ApiError` para quien necesite reaccionar a un código puntual (ej. 401).
 *
 * No incluye el interceptor global de logout ante 401 — eso es un problema de
 * estado de sesión, no de transporte, y se resuelve en KAN-160 (cliente de
 * auth).
 */

export type ApiErrorKind = "validation" | "network" | "timeout" | "http";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status?: number;
  readonly body?: unknown;

  constructor(
    message: string,
    kind: ApiErrorKind,
    options?: { status?: number; body?: unknown },
  ) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = options?.status;
    this.body = options?.body;
  }
}

export interface ApiClientOptions extends Omit<RequestInit, "signal"> {
  /** Default: 15000ms, igual que `fetchWithTimeout`. */
  timeoutMs?: number;
  /** Prefijo de los logs de error en consola. Default: `[API]`. */
  logTag?: string;
}

const DEFAULT_TIMEOUT_MS = 15000;

function hasStringErrorField(body: unknown): body is { error: string } {
  return (
    typeof body === "object" &&
    body !== null &&
    "error" in body &&
    typeof (body as { error?: unknown }).error === "string"
  );
}

/**
 * Llama a `path` (una ruta same-origin, ej. `/api/profile`) y devuelve el
 * body ya parseado como JSON. Lanza `ApiError` ante:
 * - `kind: "validation"`: mal uso del cliente (ej. `path` inválido) —
 *   error sincrónico, no llega a tocar la red.
 * - `kind: "timeout"`: no hubo respuesta dentro de `timeoutMs`.
 * - `kind: "network"`: falló la conexión (DNS, offline, CORS, etc.).
 * - `kind: "http"`: la respuesta llegó pero con status fuera de 2xx —
 *   `status` y `body` (si el servidor mandó JSON) quedan en el error.
 */
export async function apiClient<T = unknown>(
  path: string,
  options: ApiClientOptions = {},
): Promise<T> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    logTag = "[API]",
    headers,
    ...init
  } = options;

  if (typeof path !== "string" || !path.startsWith("/")) {
    throw new ApiError(
      `apiClient: "path" debe ser una ruta same-origin que empiece con "/" (recibido: ${JSON.stringify(path)})`,
      "validation",
    );
  }

  // FormData (ej. subida de archivos) necesita que el browser fije su propio
  // Content-Type con boundary — forzar "application/json" ahí rompería el
  // request. Ninguno de los dos wrappers legacy manejaba este caso porque no
  // lo necesitaban, pero KAN-216 (upload) sí va a consumir este cliente.
  const isFormData =
    typeof FormData !== "undefined" && init.body instanceof FormData;
  const mergedHeaders: HeadersInit = isFormData
    ? { ...headers }
    : { "Content-Type": "application/json", ...headers };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: mergedHeaders,
      signal: controller.signal,
    });
  } catch (error) {
    // `DOMException` (lo que tira `AbortController`) no siempre hereda de
    // `Error` según el entorno, así que se chequea `name` por duck-typing.
    if (error && typeof error === "object" && "name" in error && (error as { name: unknown }).name === "AbortError") {
      console.error(
        `${logTag} Timeout de ${timeoutMs}ms esperando respuesta de ${path}`,
      );
      throw new ApiError(
        "El servidor no respondió a tiempo. Probá de nuevo en unos segundos.",
        "timeout",
      );
    }
    const err = error as Error;
    console.error(
      `${logTag} Error de red al conectar con ${path}:`,
      err.name,
      err.message,
    );
    throw new ApiError(err.message || "Error de red", "network");
  } finally {
    clearTimeout(timer);
  }

  let body: unknown = null;
  try {
    const text = await response.text();
    body = text ? JSON.parse(text) : null;
  } catch {
    // Respuesta sin body o no-JSON — tolerado, igual que en `apiFetch`.
    body = null;
  }

  if (!response.ok) {
    const message = hasStringErrorField(body)
      ? body.error
      : `Error ${response.status}`;
    throw new ApiError(message, "http", { status: response.status, body });
  }

  return body as T;
}
