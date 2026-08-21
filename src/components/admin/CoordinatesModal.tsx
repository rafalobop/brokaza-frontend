"use client";

/**
 * `CoordinatesModal` (KAN-242) — modal de corrección de coordenadas. Port de
 * `matchouse/src/admin-dashboard/app.js` (`openCoordModal`/`syncMarkerFromInputs`/
 * `modal-save-btn` handler, líneas 226-306): mismo default (`TUCUMAN_DEFAULT` si la propiedad no
 * tiene coordenadas), misma validación de rango antes de guardar, mismo flujo (guardar → refetch
 * del listado → cerrar).
 *
 * Usa `LeafletMapDynamic` (KAN-241, nunca `LeafletMap` directo — ver
 * docs/leaflet-spike-findings.md, regla del spike) y los mismos inputs numéricos + mapa
 * sincronizados en ambos sentidos (arrastrar/click en el mapa actualiza los inputs, tipear en los
 * inputs recentra el mapa).
 */

import { useState } from "react";
import { ApiError } from "@/lib/api-client";
import { updatePropertyCoordinates } from "@/lib/coordinates-api";
import { TUCUMAN_DEFAULT } from "@/lib/map-constants";
import type { AdminProperty } from "@/lib/properties-api";
import { LeafletMapDynamic } from "./LeafletMapDynamic";

export interface CoordinatesModalProps {
  property: AdminProperty;
  onClose: () => void;
  onSaved: () => void;
}

function isValidLatLng(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    lat >= -90 &&
    lat <= 90 &&
    Number.isFinite(lng) &&
    lng >= -180 &&
    lng <= 180
  );
}

export function CoordinatesModal({ property, onClose, onSaved }: CoordinatesModalProps) {
  const [latitude, setLatitude] = useState(property.latitude ?? TUCUMAN_DEFAULT[0]);
  const [longitude, setLongitude] = useState(property.longitude ?? TUCUMAN_DEFAULT[1]);
  const [latInput, setLatInput] = useState(String(latitude));
  const [lngInput, setLngInput] = useState(String(longitude));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ message: string; type: "success" | "error" } | null>(null);

  function handleMapChange(lat: number, lng: number) {
    setLatitude(lat);
    setLongitude(lng);
    setLatInput(lat.toFixed(6));
    setLngInput(lng.toFixed(6));
  }

  function handleLatInputChange(value: string) {
    setLatInput(value);
    const parsed = parseFloat(value);
    if (Number.isFinite(parsed)) setLatitude(parsed);
  }

  function handleLngInputChange(value: string) {
    setLngInput(value);
    const parsed = parseFloat(value);
    if (Number.isFinite(parsed)) setLongitude(parsed);
  }

  async function handleSave() {
    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);
    if (!isValidLatLng(lat, lng)) {
      setStatus({ message: "Latitud/longitud fuera de rango.", type: "error" });
      return;
    }

    setSaving(true);
    setStatus(null);
    try {
      await updatePropertyCoordinates(property.id, lat, lng);
      setStatus({ message: "Guardado.", type: "success" });
      onSaved();
      // Mismo criterio que el legacy (`app.js` línea 302): deja el mensaje de éxito visible un
      // instante antes de cerrar, en vez de cerrar de golpe.
      setTimeout(onClose, 600);
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "No se pudo guardar la propiedad.";
      setStatus({ message, type: "error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="flex w-full max-w-lg flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-col gap-1">
          <h3 className="text-lg font-semibold text-black dark:text-zinc-50">
            Corregir coordenadas
          </h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{property.address}</p>
        </div>

        <LeafletMapDynamic latitude={latitude} longitude={longitude} onChange={handleMapChange} />

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-700 dark:text-zinc-300">Latitud</span>
            <input
              type="text"
              inputMode="decimal"
              value={latInput}
              onChange={(event) => handleLatInputChange(event.target.value)}
              disabled={saving}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-black outline-none focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-700 dark:text-zinc-300">Longitud</span>
            <input
              type="text"
              inputMode="decimal"
              value={lngInput}
              onChange={(event) => handleLngInputChange(event.target.value)}
              disabled={saving}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-black outline-none focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>
        </div>

        {status ? (
          <p
            className={`text-sm ${
              status.type === "error"
                ? "text-red-600 dark:text-red-400"
                : "text-emerald-600 dark:text-emerald-400"
            }`}
          >
            {status.message}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 disabled:opacity-60 dark:border-zinc-700 dark:text-zinc-300"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
