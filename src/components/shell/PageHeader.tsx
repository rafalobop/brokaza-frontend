import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  /** KAN-298: marca `title` como término crítico (ej. "Matches") que no debe traducirse. */
  notranslate?: boolean;
}

/** "page_header" del brief: título + descripción a la izquierda, acciones a la derecha. */
export function PageHeader({ title, description, actions, notranslate }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1
          translate={notranslate ? "no" : undefined}
          className={`font-heading text-foreground text-2xl font-bold tracking-tight ${notranslate ? "notranslate" : ""}`}
        >
          {title}
        </h1>
        {description ? <p className="text-text-secondary text-sm">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}
