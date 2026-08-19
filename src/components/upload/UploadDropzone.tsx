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
import { MappingConfirmModal } from "./MappingConfirmModal";
import { UploadProgressBar } from "./UploadProgressBar";

export function UploadDropzone() {
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
  } = useUpload();
  const [dragOver, setDragOver] = useState(false);
  const [mappingModalOpen, setMappingModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploading = status === "uploading";
  const needsMapping = status === "needs-mapping";

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return;
      // Cada subida arranca sin el modal abierto — si esta hace falta confirmación de mapeo, el
      // agente vuelve a decidir explícitamente si quiere "Revisar mapeo" (AC3), no se le reabre
      // automáticamente el estado del archivo anterior.
      setMappingModalOpen(false);
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
    <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-black dark:text-zinc-50">Cargar cartera</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
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
        className={`flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed px-4 py-10 text-center text-sm transition-colors ${
          uploading ? "cursor-not-allowed opacity-60" : "cursor-pointer"
        } ${
          dragOver
            ? "border-black bg-zinc-100 dark:border-white dark:bg-zinc-900"
            : "border-zinc-300 text-zinc-600 dark:border-zinc-700 dark:text-zinc-400"
        }`}
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
        <p className="text-sm text-emerald-600 dark:text-emerald-400">
          {result.priceParseErrors.length > 0
            ? `Se cargaron ${result.count} propiedades. ${result.priceParseErrors.length} con precio no reconocido (se cargaron sin precio).`
            : `¡Éxito! Se cargaron ${result.count} propiedades.`}
        </p>
      ) : null}

      {needsMapping ? (
        <div className="flex flex-col items-start gap-2">
          <p className="text-sm text-amber-600 dark:text-amber-400">
            Necesitamos que confirmes el mapeo de columnas antes de cargar el archivo
            {pendingSheets.length > 0
              ? ` (${pendingSheets.length} hoja${pendingSheets.length > 1 ? "s" : ""} pendiente${
                  pendingSheets.length > 1 ? "s" : ""
                }).`
              : "."}
          </p>
          <button
            type="button"
            onClick={() => setMappingModalOpen(true)}
            className="rounded-md bg-black px-3 py-1.5 text-xs font-medium text-white dark:bg-white dark:text-black"
          >
            Revisar mapeo
          </button>
        </div>
      ) : null}

      {status === "error" && error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : null}

      {status !== "idle" && status !== "uploading" && !needsMapping ? (
        <button
          type="button"
          onClick={reset}
          className="self-start text-xs font-medium text-zinc-500 underline underline-offset-4 dark:text-zinc-400"
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
    </section>
  );
}
