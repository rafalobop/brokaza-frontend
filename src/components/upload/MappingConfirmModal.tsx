"use client";

/**
 * `MappingConfirmModal` (KAN-217) — confirmación/corrección manual del mapeo de columnas de
 * Excel cuando ni la heurística ni la IA lo resolvieron con confianza suficiente (KAN-84,
 * `requiresMappingConfirmation`). Portado de `matchouse/src/dashboard/app.js` (líneas 761-971:
 * `openMappingConfirmModal`/`buildMappingSheetBlock`/`buildMappingFieldRow`/
 * `collectMappingSelections`), reemplazando el DOM manual por componentes React controlados.
 *
 * Mismo estilo de modal que `RejectionModal` (KAN-189): overlay fijo + tarjeta centrada, para
 * quedar visualmente coherente con el resto de la interfaz (AC5 del ticket).
 *
 * Los campos (`fields`) y cuáles son obligatorios (`required`) salen de `useMappingFields()`
 * (KAN-215) — no se hardcodea acá esa lista, a diferencia del legacy (`MAPPING_FIELDS` fijo en
 * `app.js`). Mientras esa carga está en curso, el modal se abre igual pero con los selects
 * deshabilitados en vez de bloquear la apertura — el agente ya está mirando la hoja y los
 * headers reales, no hace falta esperar.
 */

import { useMemo, useState } from "react";
import { useMappingFields } from "@/lib/use-mapping-fields";
import type { ExcelMappingField } from "@/lib/mapping-fields-api";
import type { PendingMappingSheet, SheetMappingSelections } from "@/lib/upload-api";
import type { UploadStage } from "@/lib/upload-progress";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { UploadProgressBar } from "./UploadProgressBar";

// Etiquetas de presentación — a diferencia de la lista de campos en sí (KAN-215), esto es texto
// de UI puro, no un dato de negocio que deba salir del backend.
const FIELD_LABELS: Record<ExcelMappingField, string> = {
  domicilio: "Domicilio",
  precio: "Precio",
  piso_lote: "Piso / Lote",
  dormitorios: "Dormitorios",
  expensas: "Expensas",
  caracteristicas: "Características",
  contacto: "Contacto",
  tipo: "Tipo de propiedad",
  operacion: "Operación (venta/alquiler)",
  latitud: "Latitud",
  longitud: "Longitud",
};

export interface MappingConfirmModalProps {
  sheets: PendingMappingSheet[];
  confirming: boolean;
  confirmError: string | null;
  /** KAN-218: progreso real del reprocesamiento (`POST /api/upload/confirm-mapping`) vía WS. */
  stage: UploadStage | null;
  onConfirm: (mappings: SheetMappingSelections) => void;
  onCancel: () => void;
}

function buildInitialSelections(sheets: PendingMappingSheet[]): SheetMappingSelections {
  const initial: SheetMappingSelections = {};
  sheets.forEach((sheet) => {
    const sheetSelections: Partial<Record<ExcelMappingField, string | null>> = {};
    sheet.fields.forEach((field) => {
      if (field.header && sheet.headers.includes(field.header)) {
        sheetSelections[field.field] = field.header;
      }
    });
    initial[sheet.sheetName] = sheetSelections;
  });
  return initial;
}

function sheetHint(sheet: PendingMappingSheet): string {
  if (sheet.source === "ai") return "Sugerido por IA — revisá antes de confirmar.";
  if (sheet.ambiguousFields.length > 0) {
    return "Hay columnas ambiguas: elegí manualmente cuál corresponde a cada campo.";
  }
  return "No pudimos reconocer todas las columnas de esta hoja.";
}

export function MappingConfirmModal({
  sheets,
  confirming,
  confirmError,
  stage,
  onConfirm,
  onCancel,
}: MappingConfirmModalProps) {
  const { status: fieldsStatus, fields, required } = useMappingFields();
  const [selections, setSelections] = useState<SheetMappingSelections>(() =>
    buildInitialSelections(sheets),
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const fieldsLoaded = fieldsStatus === "loaded";
  // `required` se consulta con `.has()` dentro del loop de sheets×fields más abajo — un Set
  // evita repetir el scan lineal de `.includes()` en cada celda de la grilla.
  const requiredSet = useMemo(() => new Set(required), [required]);

  function handleSelect(sheetName: string, field: ExcelMappingField, header: string) {
    setSelections((prev) => ({
      ...prev,
      [sheetName]: { ...prev[sheetName], [field]: header || null },
    }));
  }

  function handleSubmit() {
    const missing: string[] = [];
    sheets.forEach((sheet) => {
      required.forEach((field) => {
        if (!selections[sheet.sheetName]?.[field]) {
          missing.push(`${sheet.sheetName}: ${FIELD_LABELS[field]}`);
        }
      });
    });

    if (missing.length > 0) {
      setValidationError(
        `Completá los campos obligatorios antes de confirmar — ${missing.join(", ")}.`,
      );
      return;
    }

    setValidationError(null);
    onConfirm(selections);
  }

  return (
    <Modal wide onClose={confirming ? undefined : onCancel}>
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold">Confirmar mapeo de columnas</h3>
        <p className="text-sm opacity-80">
          No pudimos reconocer con confianza todas las columnas de tu Excel. Elegí manualmente qué
          columna corresponde a cada campo.
        </p>
      </div>

      <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1">
        {!fieldsLoaded ? <p className="text-sm opacity-70">Cargando campos...</p> : null}

        {sheets.map((sheet) => (
          <div
            key={sheet.sheetName}
            className="rounded-radius-md flex flex-col gap-2 border border-current/15 p-3"
          >
            <div className="text-sm font-semibold">{sheet.sheetName}</div>
            <p className="text-xs opacity-70">{sheetHint(sheet)}</p>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {fields.map((field) => {
                const isRequired = requiredSet.has(field);
                const isUnresolvedRequired = sheet.unresolvedRequiredFields.includes(field);
                const isAmbiguous = sheet.ambiguousFields.includes(field);
                const value = selections[sheet.sheetName]?.[field] ?? "";

                return (
                  <label key={field} className="flex flex-col gap-1 text-xs">
                    <span className={isUnresolvedRequired ? "text-error" : "opacity-80"}>
                      {FIELD_LABELS[field]}
                      {isRequired ? <span className="text-error"> *</span> : null}
                    </span>
                    <Select
                      value={value ?? ""}
                      disabled={!fieldsLoaded || confirming}
                      onChange={(newValue) => handleSelect(sheet.sheetName, field, newValue)}
                      className={isUnresolvedRequired ? "border-error" : ""}
                      ariaLabel={`${FIELD_LABELS[field]} — ${sheet.sheetName}`}
                      options={[
                        { value: "", label: "-- Ninguna columna --" },
                        ...sheet.headers.map((header) => ({ value: header, label: header })),
                      ]}
                    />
                    {isAmbiguous ? (
                      <span className="text-warning">
                        Varias columnas parecían coincidir con este campo.
                      </span>
                    ) : null}
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {confirming ? <UploadProgressBar stage={stage} /> : null}

      {validationError || confirmError ? (
        <p className="text-error text-sm">{validationError ?? confirmError}</p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" onClick={handleSubmit} disabled={!fieldsLoaded || confirming}>
          {confirming ? "Cargando..." : "Confirmar y cargar"}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={confirming}>
          Cancelar
        </Button>
      </div>
    </Modal>
  );
}
