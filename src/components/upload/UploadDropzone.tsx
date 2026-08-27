"use client";

/**
 * `UploadDropzone` (KAN-216/217/218) — drag&drop + selector de archivo para
 * subir el Excel de cartera. Portado de `matchouse/src/dashboard/app.js`
 * (líneas 659-724, el dropzone). Cuando el backend pide confirmar el mapeo
 * de columnas (KAN-84), muestra el aviso + el botón "Revisar mapeo" que abre
 * `MappingConfirmModal` (KAN-217, líneas 761-971 del legacy). Mientras
 * `status === "uploading"` muestra la barra de progreso real (KAN-218,
 * `UploadProgressBar`) alimentada por `useUpload().stage`.
 */

import { useCallback, useRef, useState } from "react";
import { useUpload } from "@/lib/use-upload";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { MappingConfirmModal } from "./MappingConfirmModal";
import { UploadProgressBar } from "./UploadProgressBar";
import { UploadResultModal } from "./UploadResultModal";

export interface UploadDropzoneProps {
  /** KAN-221: dispara un refresh de la tabla de propiedades apenas la subida termina con éxito. */
  onUploadSuccess?: () => void;
}

export function UploadDropzone({ onUploadSuccess }: UploadDropzoneProps = {}) {
  const {
    status,
    error,
    result,
    pendingSheets,
    confirming,
    confirmError,
    stage,
    upload,
    confirmMapping,
    reset,
  } = useUpload({ onSuccess: onUploadSuccess });
  const [dragOver, setDragOver] = useState(false);
  const [mappingModalOpen, setMappingModalOpen] = useState(false);
  // KAN-220 (provisorio): el modal de resultado se abre solo mientras `dismissed` está en false —
  // se resetea a cada subida nueva, así que arranca abierto apenas `status` pasa a "success" sin
  // necesitar un efecto que dispare setState por su cuenta.
  const [resultModalDismissed, setResultModalDismissed] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploading = status === "uploading";
  const needsMapping = status === "needs-mapping";
  const resultModalOpen = status === "success" && !resultModalDismissed;

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      // Cada subida arranca sin el modal abierto — si esta hace falta confirmación de mapeo, el
      // agente vuelve a decidir explícitamente si quiere "Revisar mapeo" (AC3), no se le reabre
      // automáticamente el estado del archivo anterior.
      setMappingModalOpen(false);
      setResultModalDismissed(false);
      void upload(files[0]);
    },
    [upload],
  );

  function handleDrop(event: React.DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    setDragOver(false);
    if (uploading) return;
    handleFiles(event.dataTransfer.files);
  }

  function handleDragOver(event: React.DragEvent<HTMLButtonElement>) {
    event.preventDefault();
    if (uploading) return;
    setDragOver(true);
  }

  function handleDragLeave() {
    setDragOver(false);
  }

  function openFilePicker() {
    if (uploading) return;
    fileInputRef.current?.click();
  }

  function handleFileInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    handleFiles(event.target.files);
    // Permite volver a elegir el mismo archivo dos veces seguidas (change no dispara si el
    // value no cambia) — mismo motivo que el legacy limpia `fileInput.value`.
    event.target.value = "";
  }

  function handleCancelMapping() {
    setMappingModalOpen(false);
    reset();
  }

  return (
    <Card className="gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-foreground text-lg font-semibold">Cargar cartera</h2>
        <p className="text-text-secondary text-sm">
          Arrastrá tu Excel de propiedades acá o hacé click para elegirlo.
        </p>
      </div>

      <button
        type="button"
        aria-label="Zona para arrastrar y soltar el archivo Excel de cartera"
        onClick={openFilePicker}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        data-testid="upload-dropzone"
        className={`rounded-radius-md flex flex-col items-center justify-center gap-2 border-2 border-dashed px-4 py-10 text-center text-sm transition-colors ${
          uploading ? "cursor-not-allowed opacity-60" : "cursor-pointer"
        } ${dragOver ? "border-accent bg-accent-glow" : "border-card-border text-text-secondary"}`}
      >
        <span>
          {uploading
            ? "Subiendo y procesando archivo..."
            : "Soltá el archivo acá o hacé click para elegirlo (.xlsx)"}
        </span>
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx"
        disabled={uploading}
        onChange={handleFileInputChange}
        className="hidden"
        aria-label="Elegir archivo Excel de cartera"
        data-testid="upload-file-input"
      />

      {uploading ? <UploadProgressBar stage={stage} /> : null}

      {status === "success" && result ? (
        <div className="flex flex-col items-start gap-2">
          <p className={result.failed.length > 0 ? "text-warning text-sm" : "text-success text-sm"}>
            ¡Listo! Se cargaron {result.count} propiedades
            {result.failed.length > 0 ? `, ${result.failed.length} con problemas.` : "."}
          </p>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => setResultModalDismissed(false)}
          >
            Ver detalle de la carga
          </Button>
        </div>
      ) : null}

      {needsMapping ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-warning text-sm">
            Necesitamos que confirmes el mapeo de columnas antes de cargar el archivo
            {pendingSheets.length > 0
              ? ` (${pendingSheets.length} hoja${pendingSheets.length > 1 ? "s" : ""} pendiente${
                  pendingSheets.length > 1 ? "s" : ""
                }).`
              : "."}
          </p>
          <Button type="button" size="sm" onClick={() => setMappingModalOpen(true)}>
            Revisar mapeo
          </Button>
        </div>
      ) : null}

      {status === "error" && error ? <p className="text-error text-sm">{error}</p> : null}

      {status !== "idle" && status !== "uploading" && !needsMapping ? (
        <button
          type="button"
          onClick={reset}
          className="text-text-secondary self-start text-xs font-medium underline underline-offset-4"
        >
          Subir otro archivo
        </button>
      ) : null}

      {needsMapping && mappingModalOpen ? (
        <MappingConfirmModal
          sheets={pendingSheets}
          confirming={confirming}
          confirmError={confirmError}
          stage={stage}
          onConfirm={(mappings) => void confirmMapping(mappings)}
          onCancel={handleCancelMapping}
        />
      ) : null}

      {resultModalOpen && result ? (
        <UploadResultModal
          loaded={result.loaded}
          failed={result.failed}
          onClose={() => setResultModalDismissed(true)}
        />
      ) : null}
    </Card>
  );
}
