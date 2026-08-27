import type { ButtonHTMLAttributes } from "react";

/**
 * Port de `.btn`/`.btn-secondary`/`.btn-danger`/`.btn-success`/`.btn-small`
 * (matchouse/src/dashboard/style.css) — primitiva compartida para unificar tenant y admin,
 * que hasta ahora improvisaban cada botón con clases de Tailwind sueltas.
 */
export type ButtonVariant = "primary" | "secondary" | "danger" | "success";
export type ButtonSize = "default" | "sm";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  // El texto de los botones primarios pasa a --teal en tema oscuro (el acento se aclara a
  // #9cc168 ahí, y el blanco/paper del resto de variantes pierde contraste) — mismo `:not()`
  // que el legacy para no pisar el color ya correcto de las otras variantes.
  primary: "bg-accent text-white hover:bg-accent-hover dark:text-teal",
  secondary:
    "bg-white/50 dark:bg-white/8 border border-card-border text-foreground hover:bg-white/20",
  danger: "bg-error-bg text-error border border-error-border hover:bg-error-border",
  success: "bg-success-bg text-success border border-success-border hover:bg-success-border",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  default: "px-6 py-3 text-sm",
  sm: "px-3 py-1.5 text-xs",
};

export function Button({
  variant = "primary",
  size = "default",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={`rounded-radius-sm font-semibold shadow-sm transition-colors duration-200 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none ${VARIANT_CLASSES[variant]} ${SIZE_CLASSES[size]} ${className}`}
    />
  );
}
