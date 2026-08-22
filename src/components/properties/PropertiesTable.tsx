"use client";

/**
 * `PropertiesTable` (KAN-273) — tabla interactiva del catálogo del tenant: filtros por operación
 * y tipo, búsqueda por dirección, orden por columna (clickeando el header), alta/edición/borrado.
 * Consume `useTenantProperties` (`/api/catalog/properties`). No usa un `<table>` HTML real — se
 * sigue el mismo patrón de lista de `Card`s + filas (`ActiveSearchesSection`/`ActiveSearchItem`)
 * que ya usa el resto del dashboard, con un header de "columnas" que dobla de control de orden.
 */

import { useState } from "react";
import { ApiError } from "@/lib/api-client";
import { useTenantProperties } from "@/lib/use-tenant-properties";
import {
  OPERATIONS,
  OPERATION_LABELS,
  PROPERTY_TYPES,
  PROPERTY_TYPE_LABELS,
  type PropertyOperation,
  type PropertyType,
  type SortableField,
} from "@/lib/tenant-properties-api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { PropertyRow } from "./PropertyRow";
import { AddPropertyModal } from "./AddPropertyModal";

const SELECT_CLASS =
  "rounded-radius-sm border-card-border text-foreground focus:border-accent border bg-white/8 px-3 py-2 text-sm outline-none";

const SORT_OPTIONS: { field: SortableField; label: string }[] = [
  { field: "address", label: "Dirección" },
  { field: "operation", label: "Operación" },
  { field: "property_type", label: "Tipo" },
  { field: "price", label: "Precio" },
  { field: "bedrooms", label: "Dormitorios" },
  { field: "updated_at", label: "Última edición" },
];

export function PropertiesTable() {
  const {
    status,
    properties,
    total,
    page,
    totalPages,
    error,
    filters,
    sort,
    order,
    setOperationFilter,
    setPropertyTypeFilter,
    setSearch,
    setSort,
    nextPage,
    prevPage,
    createProperty,
    updateProperty,
    deleteProperty,
  } = useTenantProperties();

  const [addModalOpen, setAddModalOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  async function handleCreate(input: Parameters<typeof createProperty>[0]) {
    try {
      await createProperty(input);
      setCreateError(null);
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "No se pudo crear la propiedad.");
      throw err;
    }
  }

  return (
    <Card className="gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-foreground text-lg font-semibold">Mi cartera</h2>
          <p className="text-text-secondary text-sm">
            {total} propiedad{total === 1 ? "" : "es"} cargada{total === 1 ? "" : "s"}.
          </p>
        </div>
        <Button type="button" size="sm" onClick={() => setAddModalOpen(true)}>
          Agregar propiedad
        </Button>
      </div>

      <div className="flex flex-col gap-2">
        <input
          type="search"
          aria-label="Buscar por dirección"
          placeholder="Buscar por dirección..."
          value={filters.search}
          onChange={(e) => setSearch(e.target.value)}
          className={`${SELECT_CLASS} w-full`}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Select
            ariaLabel="Filtrar por operación"
            value={filters.operation}
            onChange={(value) => setOperationFilter(value as PropertyOperation | "")}
            options={[
              { value: "", label: "Todas las operaciones" },
              ...OPERATIONS.map((op) => ({ value: op, label: OPERATION_LABELS[op] })),
            ]}
          />

          <Select
            ariaLabel="Filtrar por tipo de propiedad"
            value={filters.property_type}
            onChange={(value) => setPropertyTypeFilter(value as PropertyType | "")}
            options={[
              { value: "", label: "Todos los tipos" },
              ...PROPERTY_TYPES.map((type) => ({ value: type, label: PROPERTY_TYPE_LABELS[type] })),
            ]}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <span className="text-text-secondary text-xs">Ordenar por:</span>
        {SORT_OPTIONS.map(({ field, label }) => (
          <button
            key={field}
            type="button"
            onClick={() => setSort(field)}
            className={`rounded-radius-sm px-2 py-1 text-xs font-medium transition-colors ${
              sort === field ? "bg-accent text-white" : "text-text-secondary hover:bg-white/8"
            }`}
          >
            {label}
            {sort === field ? (order === "asc" ? " ↑" : " ↓") : ""}
          </button>
        ))}
      </div>

      {createError ? <p className="text-error text-sm">{createError}</p> : null}

      {status === "loading" && properties.length === 0 ? (
        <p className="text-text-secondary text-sm">Cargando propiedades...</p>
      ) : status === "error" ? (
        <p className="text-error text-sm">{error ?? "Error al obtener tus propiedades."}</p>
      ) : properties.length === 0 ? (
        <p className="text-text-secondary text-sm">
          No hay propiedades que coincidan con los filtros actuales.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {properties.map((property) => (
            <PropertyRow
              key={property.id}
              property={property}
              onUpdate={updateProperty}
              onDelete={deleteProperty}
            />
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={prevPage}
            disabled={page <= 1}
          >
            Anterior
          </Button>
          <span className="text-text-secondary text-xs">
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
      ) : null}

      {addModalOpen ? (
        <AddPropertyModal onCreate={handleCreate} onClose={() => setAddModalOpen(false)} />
      ) : null}
    </Card>
  );
}
