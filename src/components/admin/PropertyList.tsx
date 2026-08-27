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
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
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
    <Card className="w-full max-w-3xl gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-foreground text-lg font-semibold">Propiedades</h2>
        <p className="text-text-secondary text-sm">
          Listado de toda la cartera cargada por los tenants.
        </p>
      </div>

      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Buscar por dirección..."
        aria-label="Buscar propiedades por dirección"
        className="rounded-radius-sm border-card-border text-foreground focus:border-accent border bg-white/8 px-3 py-2 text-sm shadow-sm outline-none"
      />

      {status === "error" && error ? <p className="text-error text-sm">{error}</p> : null}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-card-border text-text-secondary border-b text-xs">
              <th className="py-2 pr-2 font-medium">Dirección</th>
              <th className="py-2 pr-2 font-medium">Zona</th>
              <th className="py-2 pr-2 font-medium">Coordenadas</th>
              <th className="py-2 pr-2 font-medium">Acción</th>
            </tr>
          </thead>
          <tbody>
            {status === "loading" && properties.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-text-secondary py-4 text-center">
                  Cargando...
                </td>
              </tr>
            ) : null}
            {status !== "loading" && properties.length === 0 ? (
              <tr>
                <td colSpan={4} className="text-text-secondary py-4 text-center">
                  No se encontraron propiedades.
                </td>
              </tr>
            ) : null}
            {properties.map((property) => (
              <tr key={property.id} className="border-card-border border-b last:border-0">
                <td className="text-foreground py-2 pr-2">{property.address}</td>
                <td className="py-2 pr-2">
                  <ZoneBadge property={property} />
                </td>
                <td className="text-text-secondary py-2 pr-2">{formatCoords(property)}</td>
                <td className="py-2 pr-2">
                  <button
                    type="button"
                    onClick={() => setEditingProperty(property)}
                    className="text-accent text-xs font-medium underline underline-offset-4"
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
        <Button type="button" variant="secondary" size="sm" onClick={prevPage} disabled={page <= 1}>
          Anterior
        </Button>
        <span className="text-text-secondary">
          Página {page} de {totalPages}
        </span>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={nextPage}
          disabled={page >= totalPages}
        >
          Siguiente
        </Button>
      </div>

      {editingProperty ? (
        <CoordinatesModal
          property={editingProperty}
          onClose={() => setEditingProperty(null)}
          onSaved={refresh}
        />
      ) : null}
    </Card>
  );
}
