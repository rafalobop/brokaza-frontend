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
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { LeafletMapDynamic } from "@/components/map/LeafletMapDynamic";

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
    <Modal onClose={saving ? undefined : onClose}>
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold">Corregir coordenadas</h3>
        <p className="text-sm opacity-80">{property.address}</p>
      </div>

      <LeafletMapDynamic latitude={latitude} longitude={longitude} onChange={handleMapChange} />

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="opacity-80">Latitud</span>
          <input
            type="text"
            inputMode="decimal"
            value={latInput}
            onChange={(event) => handleLatInputChange(event.target.value)}
            disabled={saving}
            className="rounded-radius-sm focus:border-accent border border-current/20 bg-black/5 px-3 py-2 outline-none disabled:opacity-60 dark:bg-white/5"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="opacity-80">Longitud</span>
          <input
            type="text"
            inputMode="decimal"
            value={lngInput}
            onChange={(event) => handleLngInputChange(event.target.value)}
            disabled={saving}
            className="rounded-radius-sm focus:border-accent border border-current/20 bg-black/5 px-3 py-2 outline-none disabled:opacity-60 dark:bg-white/5"
          />
        </label>
      </div>

      {status ? (
        <p className={`text-sm ${status.type === "error" ? "text-error" : "text-success"}`}>
          {status.message}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" onClick={() => void handleSave()} disabled={saving}>
          {saving ? "Guardando..." : "Guardar"}
        </Button>
        <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
          Cancelar
        </Button>
      </div>
    </Modal>
  );
}
