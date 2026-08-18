"use client";

/**
 * `RejectionModal` (KAN-189), portado de `matchouse/src/dashboard/index.html`
 * líneas 201-239 y el manejo de `matchouse/src/dashboard/app.js` líneas
 * 1463-1524. Estado local en `MatchesSection` (`rejectingMatchId`), no
 * global — ver `docs/matches-ui-design.md` §5.
 */

import { useState } from "react";

const REJECTION_REASONS = [
  { value: "mal_filtrado", label: "Mal filtrado (no es un pedido inmobiliario)" },
  { value: "mal_match_zona", label: "Zona errónea o incorrecta" },
  { value: "mal_match_caracteristicas", label: "Mal match de características (dorms, tipo, etc.)" },
  { value: "precio_incompatible", label: "Precio incompatible / fuera de rango" },
  { value: "otro", label: "Otro motivo" },
] as const;

export interface RejectionModalProps {
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}

export function RejectionModal({ onConfirm, onCancel }: RejectionModalProps) {
  const [selected, setSelected] =
    useState<(typeof REJECTION_REASONS)[number]["value"]>("mal_filtrado");
  const [manualReason, setManualReason] = useState("");

  function handleConfirm() {
    if (selected === "otro") {
      onConfirm(manualReason.trim() || "Otro motivo");
      return;
    }
    const option = REJECTION_REASONS.find((r) => r.value === selected);
    onConfirm(option?.label ?? "Otro motivo");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="flex w-full max-w-md flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-semibold text-black dark:text-zinc-50">Rechazar Match</h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Seleccioná el motivo de rechazo para ayudarnos a entrenar el modelo:
          </p>
        </div>

        <div className="flex flex-col gap-2">
          {REJECTION_REASONS.map((reason) => (
            <label key={reason.value} className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="rejection-reason"
                value={reason.value}
                checked={selected === reason.value}
                onChange={() => setSelected(reason.value)}
              />
              <span className="text-zinc-700 dark:text-zinc-300">{reason.label}</span>
            </label>
          ))}
        </div>

        {selected === "otro" ? (
          <input
            type="text"
            value={manualReason}
            onChange={(event) => setManualReason(event.target.value)}
            placeholder="Escribí el motivo detallado..."
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black outline-none focus:border-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        ) : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleConfirm}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white"
          >
            Rechazar Match
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:text-zinc-300"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
