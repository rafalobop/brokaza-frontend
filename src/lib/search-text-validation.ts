/**
 * Validación en vivo del texto de "Nueva Búsqueda" (KAN-191), port 1:1 de
 * las constantes/filtro de `matchouse/src/dashboard/app.js` (líneas
 * 1268-1298). Duplica `MAX_SEARCH_TEXT_LENGTH` de
 * `matchouse/src/utils/searchValidation.ts` (backend) — riesgo de
 * divergencia ya documentado como deuda conocida en `MIGRATION_PLAN.md` §7,
 * no resuelto por este ticket.
 */

export const MAX_SEARCH_TEXT_LENGTH = 200;

// Igual que el backend: \n y \r permitidos, el resto de los caracteres de
// control no.
const SEARCH_CONTROL_CHARS_REGEX = /[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g;

export function stripSearchControlChars(text: string): string {
  return text.replace(SEARCH_CONTROL_CHARS_REGEX, "");
}
