/**
 * `parseHighlightIds` (KAN-303) — extrae la lista de ids de `blind_matches` a resaltar desde el
 * query param `?highlight=` que arma `buildIncomingMatchPushPayload` (backend, `matchouse/src/
 * services/webPush.ts`) al construir la URL del push de "interesados en tus propiedades"
 * (`/matches?highlight=id1,id2`). Función pura separada de `MatchesPage` para poder testearla sin
 * montar React/Next navigation.
 */
export function parseHighlightIds(raw: string | null): string[] {
  if (!raw) return [];
  return raw.split(",").filter(Boolean);
}
