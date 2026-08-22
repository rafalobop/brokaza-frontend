"use client";

/**
 * `/admin/leaflet-spike` (KAN-241) — página de prueba del spike, NO parte de la navegación real
 * del panel. Prueba visual/manual de que `react-leaflet` funciona de punta a punta dentro de
 * Next.js App Router (Turbopack, SSR desactivado vía `next/dynamic`) antes de construir el modal
 * real de corrección de coordenadas (KAN-242, que va a reusar `LeafletMapDynamic` acá probado).
 */

import { useState } from "react";
import { LeafletMapDynamic } from "@/components/map/LeafletMapDynamic";
import { TUCUMAN_DEFAULT } from "@/lib/map-constants";

export default function LeafletSpikePage() {
  const [latitude, setLatitude] = useState(TUCUMAN_DEFAULT[0]);
  const [longitude, setLongitude] = useState(TUCUMAN_DEFAULT[1]);

  return (
    <div className="flex w-full max-w-2xl flex-col gap-4 px-6 py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-foreground text-xl font-semibold">Spike de Leaflet (KAN-241)</h1>
        <p className="text-text-secondary text-sm">
          Arrastrá el marker o hacé click en el mapa — las coordenadas de abajo se actualizan en
          vivo.
        </p>
      </div>

      <LeafletMapDynamic
        latitude={latitude}
        longitude={longitude}
        onChange={(lat, lng) => {
          setLatitude(lat);
          setLongitude(lng);
        }}
      />

      <p className="text-text-secondary text-sm" data-testid="leaflet-spike-coords">
        Lat: {latitude.toFixed(6)}, Lng: {longitude.toFixed(6)}
      </p>
    </div>
  );
}
