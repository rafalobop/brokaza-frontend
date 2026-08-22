/**
 * Detección del motivo "Coincidencia de Zona Geográfica" (KAN-92) en la lista de razones de un
 * match. Antes se usaba para mostrarle un tooltip explicativo al agente; ahora `IncomingMatchItem`
 * lo usa para filtrar esa razón del listado — es una explicación de cómo el matching interno
 * resuelve la zona, no información útil para quien ve quién se interesó en su propiedad.
 *
 * Riesgo heredado documentado en `docs/matches-ui-design.md` §6: la detección depende de un
 * string exacto devuelto por el backend en `reason`. Si el backend cambia el copy, esta función
 * simplemente deja de matchear y esa razón vuelve a mostrarse sin filtrar — no hay excepción ni
 * crash (AC: "manejo de errores adecuado en caso de que el string no coincida").
 */

export const ZONE_MATCH_REASON_PREFIX = "Coincidencia de Zona Geográfica";

/**
 * `undefined`/`null`/no-string no matchean (en vez de tirar) — el llamador
 * no necesita envolver esto en un try/catch para reasons con forma
 * inesperada.
 */
export function isZoneMatchReason(reason: unknown): boolean {
  return typeof reason === "string" && reason.startsWith(ZONE_MATCH_REASON_PREFIX);
}
