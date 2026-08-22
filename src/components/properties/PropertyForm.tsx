"use client";

/**
 * `PropertyForm` (KAN-273) — campos compartidos por el alta (`AddPropertyModal`) y la edición
 * inline de una fila (`PropertyRow`). Validación de cliente mínima (requeridos + numéricos ≥ 0),
 * espejo de `validateFields` en `matchouse/src/routes/properties.ts` — el backend vuelve a validar
 * igual, esto es solo para no hacer un round-trip con un 400 evitable.
 */

import { useState } from "react";
import {
  CURRENCIES,
  OPERATIONS,
  OPERATION_LABELS,
  PROPERTY_TYPES,
  PROPERTY_TYPE_LABELS,
  type CreatePropertyInput,
  type PropertyCurrency,
  type PropertyOperation,
  type PropertyType,
} from "@/lib/tenant-properties-api";
import { TUCUMAN_DEFAULT } from "@/lib/map-constants";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { LeafletMapDynamic } from "@/components/map/LeafletMapDynamic";

const INPUT_CLASS =
  "rounded-radius-sm border-card-border text-foreground focus:border-accent border bg-white/8 px-3 py-2 text-sm outline-none disabled:opacity-60";
const LABEL_CLASS = "text-text-secondary text-xs font-medium";

export interface PropertyFormValues {
  address: string;
  floor: string;
  unit: string;
  block: string;
  lot: string;
  price: string;
  currency: PropertyCurrency;
  maintenance_fees: string;
  bedrooms: string;
  features: string;
  contact_info: string;
  operation: PropertyOperation;
  property_type: PropertyType;
  latitude: number | null;
  longitude: number | null;
}

export const EMPTY_PROPERTY_FORM_VALUES: PropertyFormValues = {
  address: "",
  floor: "",
  unit: "",
  block: "",
  lot: "",
  price: "",
  currency: "USD",
  maintenance_fees: "",
  bedrooms: "",
  features: "",
  contact_info: "",
  operation: "venta",
  property_type: "departamento",
  latitude: null,
  longitude: null,
};

export interface PropertyFormProps {
  initialValues: PropertyFormValues;
  submitLabel: string;
  submitting: boolean;
  onSubmit: (input: CreatePropertyInput) => Promise<void>;
  onCancel: () => void;
}

function toCreateInput(values: PropertyFormValues): CreatePropertyInput | null {
  const address = values.address.trim();
  const price = Number(values.price);
  if (!address || !Number.isFinite(price) || price < 0) return null;

  const bedrooms = values.bedrooms.trim() ? Number(values.bedrooms) : 0;
  const maintenanceFees = values.maintenance_fees.trim() ? Number(values.maintenance_fees) : 0;
  if (!Number.isInteger(bedrooms) || bedrooms < 0) return null;
  if (!Number.isFinite(maintenanceFees) || maintenanceFees < 0) return null;

  return {
    address,
    floor: values.floor.trim() || null,
    unit: values.unit.trim() || null,
    block: values.block.trim() || null,
    lot: values.lot.trim() || null,
    price,
    currency: values.currency,
    maintenance_fees: maintenanceFees,
    bedrooms,
    features: values.features.trim() || null,
    contact_info: values.contact_info.trim() || null,
    operation: values.operation,
    property_type: values.property_type,
    latitude: values.latitude,
    longitude: values.longitude,
  };
}

export function PropertyForm({
  initialValues,
  submitLabel,
  submitting,
  onSubmit,
  onCancel,
}: PropertyFormProps) {
  const [values, setValues] = useState<PropertyFormValues>(initialValues);
  const [validationError, setValidationError] = useState<string | null>(null);

  function update<K extends keyof PropertyFormValues>(key: K, value: PropertyFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const input = toCreateInput(values);
    if (!input) {
      setValidationError(
        "Revisá los campos: dirección requerida, precio/expensas/dormitorios numéricos ≥ 0.",
      );
      return;
    }
    setValidationError(null);
    await onSubmit(input);
  }

  return (
    <form onSubmit={(event) => void handleSubmit(event)} className="flex flex-col gap-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className={LABEL_CLASS}>Dirección *</span>
          <input
            type="text"
            required
            value={values.address}
            onChange={(e) => update("address", e.target.value)}
            disabled={submitting}
            className={INPUT_CLASS}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={LABEL_CLASS}>Operación *</span>
          <Select
            value={values.operation}
            onChange={(value) => update("operation", value as PropertyOperation)}
            disabled={submitting}
            ariaLabel="Operación"
            options={OPERATIONS.map((op) => ({ value: op, label: OPERATION_LABELS[op] }))}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={LABEL_CLASS}>Tipo *</span>
          <Select
            value={values.property_type}
            onChange={(value) => update("property_type", value as PropertyType)}
            disabled={submitting}
            ariaLabel="Tipo"
            options={PROPERTY_TYPES.map((type) => ({ value: type, label: PROPERTY_TYPE_LABELS[type] }))}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={LABEL_CLASS}>Precio *</span>
          <input
            type="number"
            min={0}
            step="any"
            required
            value={values.price}
            onChange={(e) => update("price", e.target.value)}
            disabled={submitting}
            className={INPUT_CLASS}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={LABEL_CLASS}>Moneda *</span>
          <Select
            value={values.currency}
            onChange={(value) => update("currency", value as PropertyCurrency)}
            disabled={submitting}
            ariaLabel="Moneda"
            options={CURRENCIES.map((currency) => ({ value: currency, label: currency }))}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={LABEL_CLASS}>Expensas</span>
          <input
            type="number"
            min={0}
            step="any"
            value={values.maintenance_fees}
            onChange={(e) => update("maintenance_fees", e.target.value)}
            disabled={submitting}
            className={INPUT_CLASS}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={LABEL_CLASS}>Dormitorios</span>
          <input
            type="number"
            min={0}
            step="1"
            value={values.bedrooms}
            onChange={(e) => update("bedrooms", e.target.value)}
            disabled={submitting}
            className={INPUT_CLASS}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={LABEL_CLASS}>Piso</span>
          <input
            type="text"
            value={values.floor}
            onChange={(e) => update("floor", e.target.value)}
            disabled={submitting}
            className={INPUT_CLASS}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={LABEL_CLASS}>Depto/Unidad</span>
          <input
            type="text"
            value={values.unit}
            onChange={(e) => update("unit", e.target.value)}
            disabled={submitting}
            className={INPUT_CLASS}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={LABEL_CLASS}>Bloque</span>
          <input
            type="text"
            value={values.block}
            onChange={(e) => update("block", e.target.value)}
            disabled={submitting}
            className={INPUT_CLASS}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className={LABEL_CLASS}>Lote</span>
          <input
            type="text"
            value={values.lot}
            onChange={(e) => update("lot", e.target.value)}
            disabled={submitting}
            className={INPUT_CLASS}
          />
        </label>

        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className={LABEL_CLASS}>Características</span>
          <input
            type="text"
            value={values.features}
            onChange={(e) => update("features", e.target.value)}
            disabled={submitting}
            className={INPUT_CLASS}
          />
        </label>

        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className={LABEL_CLASS}>Contacto</span>
          <input
            type="text"
            value={values.contact_info}
            onChange={(e) => update("contact_info", e.target.value)}
            disabled={submitting}
            className={INPUT_CLASS}
          />
        </label>
      </div>

      <div className="flex flex-col gap-2">
        <span className={LABEL_CLASS}>Ubicación en el mapa</span>
        <LeafletMapDynamic
          latitude={values.latitude ?? TUCUMAN_DEFAULT[0]}
          longitude={values.longitude ?? TUCUMAN_DEFAULT[1]}
          onChange={(lat, lng) => {
            update("latitude", lat);
            update("longitude", lng);
          }}
        />
        <p className="text-text-secondary text-xs">
          Arrastrá el marcador o hacé click en el mapa para ajustar la ubicación exacta.
        </p>
      </div>

      {validationError ? <p className="text-error text-sm">{validationError}</p> : null}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={onCancel}
          disabled={submitting}
        >
          Cancelar
        </Button>
        <Button type="submit" size="sm" disabled={submitting}>
          {submitting ? "Guardando..." : submitLabel}
        </Button>
      </div>
    </form>
  );
}

export function propertyToFormValues(property: {
  address: string;
  floor: string | null;
  unit: string | null;
  block: string | null;
  lot: string | null;
  price: number;
  currency: PropertyCurrency;
  maintenance_fees: number;
  bedrooms: number;
  features: string | null;
  contact_info: string | null;
  operation: PropertyOperation;
  property_type: PropertyType;
  latitude: number | null;
  longitude: number | null;
}): PropertyFormValues {
  return {
    address: property.address,
    floor: property.floor ?? "",
    unit: property.unit ?? "",
    block: property.block ?? "",
    lot: property.lot ?? "",
    price: String(property.price),
    currency: property.currency,
    maintenance_fees: String(property.maintenance_fees),
    bedrooms: String(property.bedrooms),
    features: property.features ?? "",
    contact_info: property.contact_info ?? "",
    operation: property.operation,
    property_type: property.property_type,
    latitude: property.latitude,
    longitude: property.longitude,
  };
}
