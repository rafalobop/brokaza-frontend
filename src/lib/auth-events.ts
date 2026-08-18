/**
 * Interceptor de 401 explícito (KAN-160/KAN-162).
 *
 * Reemplaza el monkey-patch invisible de `window.fetch` del legacy
 * (`src/dashboard/app.js`, "Interceptor Global de Fetch para desloguear ante
 * error 401") por un event bus con nombre: `api-client.ts` emite el evento
 * cuando una respuesta HTTP llega en 401, y quien le interese (hoy,
 * `AuthProvider`) se suscribe explícitamente. Sin esto, `api-client.ts`
 * tendría que importar el contexto de React para "saber" de auth — se
 * prefiere mantenerlo agnóstico de framework.
 */

type Listener = () => void;

const listeners = new Set<Listener>();

/** Se suscribe a los 401. Devuelve la función de desuscripción. */
export function onUnauthorized(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Llamado por `api-client.ts` cuando una respuesta HTTP es 401. */
export function emitUnauthorized(): void {
  for (const listener of listeners) {
    listener();
  }
}
