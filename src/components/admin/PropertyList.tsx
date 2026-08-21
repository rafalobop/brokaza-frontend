"use client";

/**
 * `PropertyList` (KAN-240/242) — listado paginado + búsqueda de propiedades, con acción
 * "Corregir" que abre `CoordinatesModal` (KAN-242). Port de
 * `matchouse/src/admin-dashboard/app.js` (`loadProperties`/`renderProperties`/`renderPagination`,
 * líneas 148-224) e `index.html` (input de búsqueda + tabla + controles de paginación).
 */

import { useState } from "react";
import { useProperties } from "@/lib/use-properties";
import type { AdminProperty } from "@/lib/properties-api";
import { CoordinatesModal } from "./CoordinatesModal";
import { ZoneBadge } from "./ZoneBadge";

function formatCoords(property: { latitude: number | null; longitude: number | null }): string {
  if (property.latitude == null || property.longitude == null) return "(sin coordenadas)";
  return `${property.latitude.toFixed(6)}, ${property.longitude.toFixed(6)}`;
}

export function PropertyList() {
  const {
    status,
    properties,
    page,
    totalPages,
    search,
    error,
    setSearch,
    nextPage,
    prevPage,
    refresh,
  } = useProperties();
  const [editingProperty, setEditingProperty] = useState<AdminProperty | null>(null);

  return (
    <section className="flex w-full max-w-3xl flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-black dark:text-zinc-50">Propiedades</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Listado de toda la cartera cargada por los tenants.
        </p>
      </div>

      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Buscar por dirección..."
        aria-label="Buscar propiedades por dirección"
        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
      />

      {status === "error" && error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              <th className="py-2 pr-2 font-medium">Dirección</th>
              <th className="py-2 pr-2 font-medium">Zona</th>
              <th className="py-2 pr-2 font-medium">Coordenadas</th>
              <th className="py-2 pr-2 font-medium">Acción</th>
            </tr>
          </thead>
          <tbody>
            {status === "loading" && properties.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-4 text-center text-zinc-500 dark:text-zinc-400">
                  Cargando...
                </td>
              </tr>
            ) : null}
            {status !== "loading" && properties.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-4 text-center text-zinc-500 dark:text-zinc-400">
                  No se encontraron propiedades.
                </td>
              </tr>
            ) : null}
            {properties.map((property) => (
              <tr
                key={property.id}
                className="border-b border-zinc-100 last:border-0 dark:border-zinc-900"
              >
                <td className="py-2 pr-2 text-black dark:text-zinc-50">{property.address}</td>
                <td className="py-2 pr-2">
                  <ZoneBadge property={property} />
                </td>
                <td className="py-2 pr-2 text-zinc-600 dark:text-zinc-400">
                  {formatCoords(property)}
                </td>
                <td className="py-2 pr-2">
                  <button
                    type="button"
                    onClick={() => setEditingProperty(property)}
                    className="text-xs font-medium text-zinc-600 underline underline-offset-4 dark:text-zinc-400"
                  >
                    Corregir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm">
        <button
          type="button"
          onClick={prevPage}
          disabled={page <= 1}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-700 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300"
        >
          Anterior
        </button>
        <span className="text-zinc-500 dark:text-zinc-400">
          Página {page} de {totalPages}
        </span>
        <button
          type="button"
          onClick={nextPage}
          disabled={page >= totalPages}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-zinc-700 disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300"
        >
          Siguiente
        </button>
      </div>

      {editingProperty ? (
        <CoordinatesModal
          property={editingProperty}
          onClose={() => setEditingProperty(null)}
          onSaved={refresh}
        />
      ) : null}
    </section>
  );
}
