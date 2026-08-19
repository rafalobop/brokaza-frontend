"use client";

/**
 * `UploadProgressBar` (KAN-218) — barra de progreso real durante `POST /api/upload`, alimentada
 * por los eventos `upload_status` del WS (ver `useUpload`). Puramente presentacional: recibe
 * `stage` ya resuelto por el hook y no sabe nada de sockets.
 */

import { UPLOAD_STAGE_LABELS, uploadStageProgressPercent, type UploadStage } from "@/lib/upload-progress";

export interface UploadProgressBarProps {
  stage: UploadStage | null;
}

export function UploadProgressBar({ stage }: UploadProgressBarProps) {
  if (!stage) return null;

  const isError = stage === "error";
  const percent = uploadStageProgressPercent(stage);

  return (
    <div className="flex flex-col gap-1" data-testid="upload-progress-bar" data-stage={stage}>
      <div
        role="progressbar"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progreso de la subida del archivo"
        className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
      >
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            isError ? "bg-red-600 dark:bg-red-500" : "bg-black dark:bg-white"
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <span
        className={`text-xs ${
          isError ? "text-red-600 dark:text-red-400" : "text-zinc-500 dark:text-zinc-400"
        }`}
      >
        {UPLOAD_STAGE_LABELS[stage]}
      </span>
    </div>
  );
}
