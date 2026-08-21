"use client";

/**
 * `LeafletMap` (KAN-241, spike) — prototipo de `react-leaflet` para el panel admin. Port del
 * mapa de `matchouse/src/admin-dashboard/app.js` (`openCoordModal`, líneas 226-264): mismo tile
 * layer (OpenStreetMap), mismo default (`TUCUMAN_DEFAULT`), mismo patrón de interacción (marker
 * arrastrable + click en el mapa reposiciona el marker).
 *
 * Hallazgos del spike (detalle completo en docs/leaflet-spike-findings.md):
 * - Leaflet toca `window`/`document` al importarse — rompe SSR/build de Next.js si se importa
 *   estático. Se importa con `next/dynamic` y `ssr: false` desde quien lo use (no acá adentro,
 *   ver comentario al final del archivo).
 * - El CSS de Leaflet (`leaflet/dist/leaflet.css`) hay que importarlo una vez, en este archivo —
 *   `MapContainer` sin él renderiza con el tile layer roto (sin tamaño, controles superpuestos).
 * - Los íconos default de Leaflet referencian assets por URL relativa a su propio paquete, que
 *   Webpack/Turbopack no resuelve solos — hace falta el fix de `L.Icon.Default.mergeOptions` de
 *   más abajo (problema conocido y documentado del propio Leaflet en bundlers modernos, no
 *   específico de este proyecto).
 */

import { useEffect } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";

// Fix de íconos default (ver comentario de arriba) — se aplica una sola vez a nivel de módulo.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

export interface LeafletMapProps {
  latitude: number;
  longitude: number;
  onChange: (latitude: number, longitude: number) => void;
}

function ClickHandler({ onChange }: { onChange: LeafletMapProps["onChange"] }) {
  useMapEvents({
    click(event) {
      onChange(event.latlng.lat, event.latlng.lng);
    },
  });
  return null;
}

export function LeafletMap({ latitude, longitude, onChange }: LeafletMapProps) {
  const position: [number, number] = [latitude, longitude];

  return (
    <MapContainer center={position} zoom={15} style={{ height: "300px", width: "100%" }}>
      <TileLayer
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap contributors"
      />
      <Marker
        position={position}
        draggable
        eventHandlers={{
          dragend: (event) => {
            const marker = event.target as L.Marker;
            const pos = marker.getLatLng();
            onChange(pos.lat, pos.lng);
          },
        }}
      />
      <ClickHandler onChange={onChange} />
      <RecenterOnPropsChange latitude={latitude} longitude={longitude} />
    </MapContainer>
  );
}

// El mapa de Leaflet no se re-centra solo cuando `center` cambia después del montaje inicial
// (comportamiento documentado de la librería, no un bug) — hace falta `useMap().setView()`
// explícito. Necesario para cuando `latitude`/`longitude` cambian por fuera del mapa (ej. el
// agente tipea las coordenadas a mano en un input, KAN-242).
function RecenterOnPropsChange({ latitude, longitude }: { latitude: number; longitude: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView([latitude, longitude]);
  }, [map, latitude, longitude]);
  return null;
}
