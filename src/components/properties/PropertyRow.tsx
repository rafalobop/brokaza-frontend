"use client";

/**
 * `PropertyRow` (KAN-273) — una fila de la tabla interactiva, expandible para editar (AC "cada
 * fila se puede expandir para editar sus detalles"). Al expandir muestra `PropertyForm`
 * prellenado; al guardar manda `expectedUpdatedAt` = el `updated_at` que esta fila tenía en
 * memoria (el que el usuario vio), para que el backend detecte si alguien más la tocó mientras
 * tanto (concurrencia optimista, ver `useTenantProperties.updateProperty`).
 */

import { useState } from "react";
import { ApiError } from "@/lib/api-client";
import {
  OPERATION_LABELS,
  PROPERTY_TYPE_LABELS,
  type CreatePropertyInput,
  type TenantProperty,
  type UpdatePropertyInput,
} from "@/lib/tenant-properties-api";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { PropertyForm, propertyToFormValues } from "./PropertyForm";

const OPERATION_BADGE_VARIANT: Record<TenantProperty["operation"], BadgeVariant> = {
  venta: "info",
  alquiler: "success",
  compra: "warning",
};

// Tipos donde "dormitorios" tiene sentido como dato (casa incluye duplex/PH/chalet — el parseo de
// Excel los normaliza a "casa", ver `detectTipoPropiedad` en matchouse/src/services/excel.ts).
// Terreno/local/oficina/otro (lote, galpón, etc.) no tienen dormitorios, mostrarlo ahí confunde.
const PROPERTY_TYPES_WITH_BEDROOMS: ReadonlySet<TenantProperty["property_type"]> = new Set([
  "casa",
  "departamento",
]);

export interface PropertyRowProps {
  property: TenantProperty;
  onUpdate: (
    id: string,
    input: UpdatePropertyInput,
  ) => Promise<{ conflict: TenantProperty | null }>;
  onDelete: (id: string) => Promise<void>;
  /** KAN-305: pedido de revisión de coordenadas — solo prende `needs_coordinate_review`. */
  onRequestCoordinateCorrection: (id: string) => Promise<void>;
}

function formatPrice(property: TenantProperty): string {
  return `${property.currency} ${property.price.toLocaleString("es-AR")}`;
}

export function PropertyRow({
  property,
  onUpdate,
  onDelete,
  onRequestCoordinateCorrection,
}: PropertyRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const [conflictNotice, setConflictNotice] = useState<string | null>(null);

  // KAN-305: PropertyForm entrega siempre un CreatePropertyInput completo (incluye
  // latitude/longitude, que en modo edición el mapa de solo lectura nunca modifica) — se descartan
  // acá antes de armar el PATCH porque el backend ya no los acepta como campo editable (whitelist
  // de UPDATE_FIELDS en properties.ts). Mandarlos igual (aunque sin cambios) daría 400.
  async function handleSave(input: CreatePropertyInput) {
    const editableFields: Omit<UpdatePropertyInput, "expectedUpdatedAt"> = {
      address: input.address,
      floor: input.floor,
      unit: input.unit,
      block: input.block,
      lot: input.lot,
      price: input.price,
      currency: input.currency,
      maintenance_fees: input.maintenance_fees,
      bedrooms: input.bedrooms,
      features: input.features,
      contact_info: input.contact_info,
      operation: input.operation,
      property_type: input.property_type,
    };
    setSaving(true);
    setRowError(null);
    setConflictNotice(null);
    try {
      const { conflict } = await onUpdate(property.id, {
        ...editableFields,
        expectedUpdatedAt: property.updated_at,
      });
      if (conflict) {
        setConflictNotice(
          "Esta propiedad fue modificada por otra persona mientras la editabas. Se actualizó con los datos actuales — revisá y volvé a guardar si hace falta.",
        );
        return;
      }
      setExpanded(false);
    } catch (err) {
      setRowError(err instanceof ApiError ? err.message : "No se pudo guardar la propiedad.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRequestCorrection() {
    await onRequestCoordinateCorrection(property.id);
  }

  async function handleDelete() {
    setDeleting(true);
    setRowError(null);
    try {
      await onDelete(property.id);
    } catch (err) {
      setRowError(err instanceof ApiError ? err.message : "No se pudo eliminar la propiedad.");
      setDeleting(false);
    } finally {
      setConfirmingDelete(false);
    }
  }

  return (
    <div className="rounded-radius-md border-card-border bg-card flex flex-col gap-2 border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-foreground truncate text-sm font-medium">{property.address}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={OPERATION_BADGE_VARIANT[property.operation]}>
              {OPERATION_LABELS[property.operation]}
            </Badge>
            <Badge variant="info">{PROPERTY_TYPE_LABELS[property.property_type]}</Badge>
            {/* KAN-305: estado visible de la solicitud de corrección sin tener que expandir la
             * fila — el AC pide que quede claro que hay un pedido pendiente. */}
            {property.needs_coordinate_review ? (
              <Badge variant="warning">Ubicación en revisión</Badge>
            ) : null}
            <span className="text-text-secondary text-xs">{formatPrice(property)}</span>
            {PROPERTY_TYPES_WITH_BEDROOMS.has(property.property_type) ? (
              <span className="text-text-secondary text-xs">
                {property.bedrooms} dorm{property.bedrooms === 1 ? "" : "s"}.
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              setExpanded((prev) => !prev);
              setRowError(null);
              setConflictNotice(null);
            }}
            disabled={deleting}
          >
            {expanded ? "Cerrar" : "Editar"}
          </Button>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => setConfirmingDelete(true)}
            disabled={deleting}
          >
            {deleting ? "Eliminando..." : "Eliminar"}
          </Button>
        </div>
      </div>

      {confirmingDelete ? (
        <ConfirmModal
          title="Eliminar propiedad"
          message={`¿Eliminar la propiedad "${property.address}"? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          confirming={deleting}
          onConfirm={() => void handleDelete()}
          onCancel={() => setConfirmingDelete(false)}
        />
      ) : null}

      {rowError ? <p className="text-error text-sm">{rowError}</p> : null}
      {conflictNotice ? <p className="text-warning text-sm">{conflictNotice}</p> : null}

      {expanded ? (
        <div className="border-card-border border-t pt-3">
          <PropertyForm
            initialValues={propertyToFormValues(property)}
            submitLabel="Guardar cambios"
            submitting={saving}
            onSubmit={handleSave}
            onCancel={() => setExpanded(false)}
            coordinateReview={{
              needsReview: property.needs_coordinate_review,
              onRequestCorrection: handleRequestCorrection,
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
