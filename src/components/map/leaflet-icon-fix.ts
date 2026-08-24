/**
 * Fix de íconos default de Leaflet (KAN-241 spike, docs/leaflet-spike-findings.md): el paquete
 * referencia sus imágenes de marker por URL relativa a sí mismo, que Webpack/Turbopack no
 * resuelve solos. Se aplica una sola vez a nivel de módulo — cualquier componente que renderice
 * un `<Marker>` (`LeafletMap`) debe importar este archivo antes.
 */
import L from "leaflet";

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});
