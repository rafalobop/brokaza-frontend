"use client";

/**
 * `LeafletMapDynamic` (KAN-241) — wrapper con `next/dynamic({ ssr: false })` sobre `LeafletMap`.
 * Leaflet toca `window`/`document`/`navigator` en su propio módulo top-level (detección de
 * soporte táctil, etc.) — importarlo estático rompe el build/SSR de Next.js con
 * `ReferenceError: window is not defined`. Separado en su propio archivo para que cualquier
 * consumidor futuro (KAN-242, el modal de corrección de coordenadas) importe este wrapper en vez
 * de tener que acordarse de envolver `LeafletMap` con `dynamic()` cada vez.
 */

import dynamic from "next/dynamic";

export const LeafletMapDynamic = dynamic(
  () => import("./LeafletMap").then((mod) => mod.LeafletMap),
  {
    ssr: false,
    loading: () => (
      <div
        style={{ height: "300px" }}
        className="rounded-radius-md border-card-border text-text-secondary flex w-full items-center justify-center border text-sm"
      >
        Cargando mapa...
      </div>
    ),
  },
);
