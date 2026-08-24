"use client";

/** `AddPropertyModal` (KAN-273) — alta manual de una propiedad desde la UI (AC "los usuarios pueden agregar nuevas propiedades desde la interfaz"). */

import { useState } from "react";
import { ApiError } from "@/lib/api-client";
import type { CreatePropertyInput } from "@/lib/tenant-properties-api";
import { Modal } from "@/components/ui/Modal";
import { EMPTY_PROPERTY_FORM_VALUES, PropertyForm } from "./PropertyForm";

export interface AddPropertyModalProps {
  onCreate: (input: CreatePropertyInput) => Promise<void>;
  onClose: () => void;
}

export function AddPropertyModal({ onCreate, onClose }: AddPropertyModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(input: CreatePropertyInput) {
    setSubmitting(true);
    setError(null);
    try {
      await onCreate(input);
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo crear la propiedad.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal wide onClose={onClose}>
      <h2 className="text-foreground text-lg font-semibold">Agregar propiedad</h2>
      {error ? <p className="text-error text-sm">{error}</p> : null}
      <PropertyForm
        initialValues={EMPTY_PROPERTY_FORM_VALUES}
        submitLabel="Crear propiedad"
        submitting={submitting}
        onSubmit={handleSubmit}
        onCancel={onClose}
      />
    </Modal>
  );
}
