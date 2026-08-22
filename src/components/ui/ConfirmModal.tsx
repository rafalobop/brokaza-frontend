"use client";

import { Modal } from "./Modal";
import { Button } from "./Button";
import type { ButtonVariant } from "./Button";

export interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmVariant?: ButtonVariant;
  confirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Reemplaza `window.confirm` por un modal con el mismo look & feel del resto de la UI. */
export function ConfirmModal({
  title,
  message,
  confirmLabel = "Confirmar",
  cancelLabel = "Cancelar",
  confirmVariant = "danger",
  confirming = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <Modal onClose={confirming ? undefined : onCancel}>
      <div className="flex flex-col gap-1">
        <h3 className="text-foreground text-lg font-semibold">{title}</h3>
        <p className="text-text-secondary text-sm">{message}</p>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="secondary" onClick={onCancel} disabled={confirming}>
          {cancelLabel}
        </Button>
        <Button type="button" variant={confirmVariant} onClick={onConfirm} disabled={confirming}>
          {confirming ? "Procesando..." : confirmLabel}
        </Button>
      </div>
    </Modal>
  );
}
