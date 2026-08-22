import Link from "next/link";
import type { AnchorHTMLAttributes } from "react";

/**
 * Variante clickeable de `Card` — mismas clases visuales, pero como `<Link>` de Next.js en vez
 * de `<div>`, para las cards del dashboard que redirigen a su página completa al hacer click
 * (Resumen: Propiedades/Matches/Búsquedas/Interesados, previews de "Últimos matches"/"Búsquedas
 * en curso"). Separado de `Card` (no un prop `href` opcional ahí) para que `Card` siga siendo un
 * `<div>` simple en el resto de los usos, sin lógica condicional de tag.
 */
interface LinkCardProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
}

export function LinkCard({ href, className = "", ...props }: LinkCardProps) {
  return (
    <Link
      href={href}
      {...props}
      className={`rounded-radius-lg border-card-border bg-card hover:border-accent-glow focus-visible:outline-accent flex flex-col gap-4 border p-5 transition-colors duration-200 focus-visible:outline-2 ${className}`}
    />
  );
}
