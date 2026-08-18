/**
 * Tooltip de "Coincidencia de Zona Geográfica" (KAN-189), portado de
 * `matchouse/src/dashboard/app.js` líneas 1049-1060 (KAN-92). La zona se
 * resuelve automáticamente en el backend (`utils/matcher.ts`) por
 * coordenadas o texto libre — no es evidente para el usuario, así que cada
 * razón de match que empieza con este prefijo fijo (controlado por
 * nosotros mismos en el backend) se acompaña de una explicación.
 *
 * Riesgo heredado documentado en `docs/matches-ui-design.md` §6: la
 * detección depende de un string exacto devuelto por el backend en
 * `reason`. Si el backend cambia el copy, esta función simplemente deja de
 * matchear y el tooltip no se muestra — no hay excepción ni crash (AC:
 * "manejo de errores adecuado en caso de que el string no coincida").
 */

export const ZONE_MATCH_REASON_PREFIX = "Coincidencia de Zona Geográfica";

export const ZONE_MATCH_TOOLTIP =
  "La zona se resuelve automáticamente por la ubicación de la propiedad (coordenadas o dirección de texto), comparada contra la zona pedida en la búsqueda.";

/**
 * `undefined`/`null`/no-string no matchean (en vez de tirar) — el llamador
 * no necesita envolver esto en un try/catch para reasons con forma
 * inesperada.
 */
export function isZoneMatchReason(reason: unknown): boolean {
  return typeof reason === "string" && reason.startsWith(ZONE_MATCH_REASON_PREFIX);
}
