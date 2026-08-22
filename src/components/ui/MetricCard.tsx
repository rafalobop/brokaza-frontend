import type { LucideIcon } from "lucide-react";
import { Card } from "./Card";
import { LinkCard } from "./LinkCard";

/**
 * Card de métrica de resumen (row_1 del dashboard, 4 iguales) — patrón
 * "metric_card_pattern" del brief: label + ícono arriba, valor grande al medio,
 * status/nota chica abajo. Con `href`, la card entera redirige a la página completa.
 */
interface MetricCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  status?: string;
  statusVariant?: "success" | "warning" | "error" | "neutral";
  href?: string;
}

const STATUS_CLASSES: Record<NonNullable<MetricCardProps["statusVariant"]>, string> = {
  success: "text-success",
  warning: "text-warning",
  error: "text-error",
  neutral: "text-text-secondary",
};

export function MetricCard({
  label,
  value,
  icon: Icon,
  status,
  statusVariant = "neutral",
  href,
}: MetricCardProps) {
  const content = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-text-secondary text-sm">{label}</span>
        <span className="bg-accent-glow text-accent flex h-8 w-8 items-center justify-center rounded-full">
          <Icon className="h-4 w-4" aria-hidden="true" />
        </span>
      </div>
      <p className="font-heading text-foreground text-3xl font-bold">{value}</p>
      {status ? (
        <p className={`text-xs font-medium ${STATUS_CLASSES[statusVariant]}`}>{status}</p>
      ) : null}
    </>
  );

  if (href) {
    return (
      <LinkCard href={href} className="gap-3">
        {content}
      </LinkCard>
    );
  }

  return <Card className="gap-3">{content}</Card>;
}
