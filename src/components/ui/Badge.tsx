import type { HTMLAttributes } from "react";

/**
 * Port de `.search-badge`/`.curation-badge`/`.match-score-badge`/admin `.badge`
 * (matchouse/src/dashboard/style.css, matchouse/src/admin-dashboard/style.css) — todas
 * variaciones del mismo patrón (pill con bg/texto/borde semántico), unificadas acá.
 */
export type BadgeVariant = "success" | "warning" | "error" | "info";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  success: "bg-success-bg text-success border-success-border",
  warning: "bg-warning-bg text-warning border-warning-border",
  error: "bg-error-bg text-error border-error-border",
  info: "bg-info-bg text-info border-info-border",
};

export function Badge({ variant = "info", className = "", ...props }: BadgeProps) {
  return (
    <span
      {...props}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap ${VARIANT_CLASSES[variant]} ${className}`}
    />
  );
}
