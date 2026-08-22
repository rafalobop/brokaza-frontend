import type { HTMLAttributes } from "react";

/** Port de `.status-msg` (matchouse/src/dashboard/style.css). */
export type StatusMessageVariant = "success" | "warning" | "error";

interface StatusMessageProps extends HTMLAttributes<HTMLParagraphElement> {
  variant: StatusMessageVariant;
}

const VARIANT_CLASSES: Record<StatusMessageVariant, string> = {
  success: "bg-success-bg text-success border-success-border",
  warning: "bg-warning-bg text-warning border-warning-border",
  error: "bg-error-bg text-error border-error-border",
};

export function StatusMessage({ variant, className = "", ...props }: StatusMessageProps) {
  return (
    <p
      {...props}
      className={`rounded-radius-sm border px-4 py-3 text-center text-sm ${VARIANT_CLASSES[variant]} ${className}`}
    />
  );
}
