/**
 * KAN-298: el traductor automático del navegador (Chrome/Edge "Traducir esta página", etc.)
 * detecta el dashboard como contenido en español y ofrece traducirlo, arrastrando con él
 * términos de producto que deben quedar intactos en cualquier idioma — el caso reportado es
 * "matches" → "partidos" (colisiona con la acepción deportiva).
 *
 * Términos críticos identificados (no deben traducirse nunca):
 * - "Brokaza" — nombre de marca, aparece en el sidebar, pantallas de login y textos de error.
 * - "Match(es)" — término de producto (una propiedad que matchea con una búsqueda activa),
 *   usado en la nav, el título de la página `/matches` y el contador de resultados por búsqueda.
 *
 * `translate="no"` es el atributo HTML estándar que reconocen Chrome/Edge/Safari; `notranslate`
 * es la clase equivalente que reconoce Google Translate específicamente (incluida por las dudas,
 * es el mecanismo que documenta Google para este caso). Se aplican juntos porque ninguno de los
 * dos cubre el 100% de motores de traducción por sí solo.
 */

import type { ElementType, ReactNode } from "react";

interface NoTranslateProps {
  children: ReactNode;
  as?: ElementType;
  className?: string;
}

export function NoTranslate({
  children,
  as: Component = "span",
  className = "",
}: NoTranslateProps) {
  return (
    <Component translate="no" className={`notranslate ${className}`.trim()}>
      {children}
    </Component>
  );
}
