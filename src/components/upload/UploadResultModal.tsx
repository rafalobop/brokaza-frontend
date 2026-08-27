"use client";

/**
 * `UploadResultModal` (KAN-220) — al terminar `POST /api/upload` (o
 * `/confirm-mapping`), muestra el detalle propiedad por propiedad de la subida: qué se cargó sin
 * problemas (`loaded`) y qué no se cargó completo y por qué (`failed`, que une precio no
 * reconocido, geocoding fallido y hojas omitidas — ver `buildUploadSummary` en
 * `matchouse/src/controllers/uploadController.ts`). Complementa (no reemplaza) el resumen corto
 * que ya mostraba `UploadDropzone` en línea.
 */

import { useState } from "react";
import type { UploadFailureDetail, UploadLoadedProperty } from "@/lib/upload-api";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

export interface UploadResultModalProps {
  loaded: UploadLoadedProperty[];
  failed: UploadFailureDetail[];
  onClose: () => void;
}

type Tab = "loaded" | "failed";

export function UploadResultModal({ loaded, failed, onClose }: UploadResultModalProps) {
  const [tab, setTab] = useState<Tab>(failed.length > 0 ? "failed" : "loaded");

  const currentRows = tab === "loaded" ? loaded : failed;

  const tabButtonClass = (active: boolean) =>
    `rounded-radius-sm px-3 py-1.5 text-sm font-semibold transition-colors ${
      active
        ? "bg-accent text-white"
        : "bg-white/50 text-foreground hover:bg-white/20 dark:bg-white/8"
    }`;

  return (
    <Modal wide onClose={onClose}>
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold">Resultado de la carga</h3>
        <p className="text-text-secondary text-sm">
          {loaded.length} propiedad{loaded.length === 1 ? "" : "es"} cargada
          {loaded.length === 1 ? "" : "s"} correctamente
          {failed.length > 0 ? ` · ${failed.length} con problemas` : "."}
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          className={tabButtonClass(tab === "loaded")}
          onClick={() => setTab("loaded")}
        >
          Cargadas ({loaded.length})
        </button>
        <button
          type="button"
          className={tabButtonClass(tab === "failed")}
          onClick={() => setTab("failed")}
        >
          Con problemas ({failed.length})
        </button>
      </div>

      <div className="max-h-[55vh] overflow-y-auto pr-1">
        {currentRows.length === 0 ? (
          <p className="text-text-secondary py-6 text-center text-sm">
            {tab === "loaded"
              ? "No se cargó ninguna propiedad."
              : "No hubo problemas al cargar el archivo."}
          </p>
        ) : tab === "loaded" ? (
          <LoadedTable rows={loaded} />
        ) : (
          <FailedTable rows={failed} />
        )}
      </div>

      <div className="flex justify-end">
        <Button type="button" variant="secondary" onClick={onClose}>
          Cerrar
        </Button>
      </div>
    </Modal>
  );
}

function LoadedTable({ rows }: { rows: UploadLoadedProperty[] }) {
  return (
    <table className="w-full text-left text-sm">
      <thead className="text-text-secondary sticky top-0 bg-inherit text-xs uppercase">
        <tr>
          <th className="py-1.5 pr-2">Hoja</th>
          <th className="py-1.5 pr-2">Domicilio</th>
          <th className="py-1.5 pr-2">Operación</th>
          <th className="py-1.5 pr-2">Precio</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr
            key={`${row.sheetName}-${row.address}-${i}`}
            className="border-card-border/60 border-t"
          >
            <td className="py-1.5 pr-2">{row.sheetName}</td>
            <td className="py-1.5 pr-2">{row.address}</td>
            <td className="py-1.5 pr-2 capitalize">{row.operation}</td>
            <td className="py-1.5 pr-2">
              {row.price > 0 ? `${row.currency} ${row.price.toLocaleString("es-AR")}` : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function FailedTable({ rows }: { rows: UploadFailureDetail[] }) {
  return (
    <table className="w-full text-left text-sm">
      <thead className="text-text-secondary sticky top-0 bg-inherit text-xs uppercase">
        <tr>
          <th className="py-1.5 pr-2">Hoja</th>
          <th className="py-1.5 pr-2">Domicilio</th>
          <th className="py-1.5 pr-2">Motivo</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr
            key={`${row.sheetName}-${row.address ?? "sheet"}-${i}`}
            className="border-card-border/60 border-t"
          >
            <td className="py-1.5 pr-2">{row.sheetName}</td>
            <td className="py-1.5 pr-2">
              {row.address ?? <span className="opacity-60">(hoja completa)</span>}
            </td>
            <td className="text-warning py-1.5 pr-2">{row.reason}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
