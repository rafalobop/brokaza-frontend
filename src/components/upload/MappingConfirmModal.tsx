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

import { useState } from "react";
import { useMappingFields } from "@/lib/use-mapping-fields";
import type { ExcelMappingField } from "@/lib/mapping-fields-api";
import type { PendingMappingSheet, SheetMappingSelections } from "@/lib/upload-api";

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
  onConfirm,
  onCancel,
}: MappingConfirmModalProps) {
  const { status: fieldsStatus, fields, required } = useMappingFields();
  const [selections, setSelections] = useState<SheetMappingSelections>(() =>
    buildInitialSelections(sheets),
  );
  const [validationError, setValidationError] = useState<string | null>(null);
  const fieldsLoaded = fieldsStatus === "loaded";

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8">
      <div className="flex w-full max-w-2xl flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-semibold text-black dark:text-zinc-50">
            Confirmar mapeo de columnas
          </h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No pudimos reconocer con confianza todas las columnas de tu Excel. Elegí manualmente
            qué columna corresponde a cada campo.
          </p>
        </div>

        <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto pr-1">
          {!fieldsLoaded ? (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Cargando campos...</p>
          ) : null}

          {sheets.map((sheet) => (
            <div
              key={sheet.sheetName}
              className="flex flex-col gap-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
            >
              <div className="text-sm font-semibold text-black dark:text-zinc-50">
                {sheet.sheetName}
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{sheetHint(sheet)}</p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {fields.map((field) => {
                  const isRequired = required.includes(field);
                  const isUnresolvedRequired = sheet.unresolvedRequiredFields.includes(field);
                  const isAmbiguous = sheet.ambiguousFields.includes(field);
                  const value = selections[sheet.sheetName]?.[field] ?? "";

                  return (
                    <label key={field} className="flex flex-col gap-1 text-xs">
                      <span
                        className={
                          isUnresolvedRequired
                            ? "text-red-600 dark:text-red-400"
                            : "text-zinc-700 dark:text-zinc-300"
                        }
                      >
                        {FIELD_LABELS[field]}
                        {isRequired ? <span className="text-red-600 dark:text-red-400"> *</span> : null}
                      </span>
                      <select
                        value={value ?? ""}
                        disabled={!fieldsLoaded || confirming}
                        onChange={(event) => handleSelect(sheet.sheetName, field, event.target.value)}
                        className={`rounded-md border bg-white px-2 py-1 text-sm text-black outline-none disabled:opacity-60 dark:bg-zinc-900 dark:text-zinc-50 ${
                          isUnresolvedRequired
                            ? "border-red-400 dark:border-red-600"
                            : "border-zinc-300 dark:border-zinc-700"
                        }`}
                      >
                        <option value="">-- Ninguna columna --</option>
                        {sheet.headers.map((header) => (
                          <option key={header} value={header}>
                            {header}
                          </option>
                        ))}
                      </select>
                      {isAmbiguous ? (
                        <span className="text-amber-600 dark:text-amber-400">
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

        {validationError || confirmError ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            {validationError ?? confirmError}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!fieldsLoaded || confirming}
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
          >
            {confirming ? "Cargando..." : "Confirmar y cargar"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={confirming}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
