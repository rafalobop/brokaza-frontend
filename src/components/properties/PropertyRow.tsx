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

export interface PropertyRowProps {
  property: TenantProperty;
  onUpdate: (
    id: string,
    input: UpdatePropertyInput,
  ) => Promise<{ conflict: TenantProperty | null }>;
  onDelete: (id: string) => Promise<void>;
}

function formatPrice(property: TenantProperty): string {
  return `${property.currency} ${property.price.toLocaleString("es-AR")}`;
}

export function PropertyRow({ property, onUpdate, onDelete }: PropertyRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const [conflictNotice, setConflictNotice] = useState<string | null>(null);

  async function handleSave(input: Omit<UpdatePropertyInput, "expectedUpdatedAt">) {
    setSaving(true);
    setRowError(null);
    setConflictNotice(null);
    try {
      const { conflict } = await onUpdate(property.id, {
        ...input,
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
            <span className="text-text-secondary text-xs">{formatPrice(property)}</span>
            <span className="text-text-secondary text-xs">
              {property.bedrooms} dorm{property.bedrooms === 1 ? "" : "s"}.
            </span>
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
          />
        </div>
      ) : null}
    </div>
  );
}
