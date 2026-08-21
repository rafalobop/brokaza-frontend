/**
 * Constantes del mapa (KAN-241) separadas de `LeafletMap.tsx` a propósito: cualquier módulo que
 * importe algo de `LeafletMap.tsx` arrastra `leaflet` entero (y su código que toca `window` al
 * evaluarse) al bundle del servidor, sin importar que el componente en sí se cargue con
 * `dynamic(..., { ssr: false })` — un `import` estático de un solo símbolo trae el módulo
 * completo. Ver docs/leaflet-spike-findings.md.
 */
export const TUCUMAN_DEFAULT: [number, number] = [-26.8241, -65.2226];
