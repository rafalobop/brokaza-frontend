"use client";

/**
 * `IncomingMatchItem` (KAN-190) — acordeón de un match entrante, portado de
 * `buildIncomingMatchItem` en `matchouse/src/dashboard/app.js` (líneas
 * 1170-1227). Solo lectura: sin acciones de aceptar/rechazar.
 *
 * El motivo "Coincidencia de Zona Geográfica" (KAN-92) se filtra del listado de razones — es una
 * explicación de cómo el matching interno resuelve la zona, no información útil para el agente
 * que ve quién se interesó en su propiedad (pedido explícito, no un descarte por error del
 * backend).
 *
 * El detalle de contacto se muestra como filas etiquetadas (Búsqueda/Interesado/Inmobiliaria/
 * Teléfono/Email) en vez de un párrafo denso con guiones — orden pensado para la UX del agente
 * que recibe el match: primero qué buscaban (contexto), después quién y cómo contactarlo.
 */

import type { ReactNode } from "react";
import { isZoneMatchReason } from "@/lib/match-zone-tooltip";
import type { IncomingMatch } from "@/lib/matches-api";
import { Badge } from "@/components/ui/Badge";

export interface IncomingMatchItemProps {
  match: IncomingMatch;
}

// Verde de WhatsApp — mismo `.contact-link` del legacy (matchouse/src/dashboard/style.css),
// no un token de marca (no cambia con el tema).
const CONTACT_LINK_CLASS = "font-semibold underline underline-offset-2 [color:#25d366]";

function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap gap-1.5 text-sm">
      <span className="text-text-secondary shrink-0 font-medium">{label}:</span>
      <span className="text-foreground">{children}</span>
    </div>
  );
}

export function IncomingMatchItem({ match }: IncomingMatchItemProps) {
  const { searcherContact: contact } = match;
  const phoneDigits = (contact.phone_number || "").replace(/\D/g, "");
  const visibleReasons = match.reasons.filter((reason) => !isZoneMatchReason(reason));

  return (
    <details className="rounded-radius-md border-card-border border">
      <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 px-4 py-3">
        <div className="flex flex-col">
          <strong className="text-foreground">{match.property.domicilio}</strong>
          <span className="text-text-secondary text-sm">
            {match.property.moneda} {match.property.precio} ({match.property.operacion})
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-text-secondary text-xs">{match.fecha}</span>
          <Badge variant="info">{match.score}%</Badge>
        </div>
      </summary>

      <div className="border-card-border flex flex-col gap-2 border-t px-4 py-3">
        <InfoRow label="Búsqueda">
          <span className="italic">&quot;{match.searchText}&quot;</span>
        </InfoRow>

        <InfoRow label="Interesado">{contact.full_name || "Sin datos de contacto"}</InfoRow>

        {contact.agency_name ? <InfoRow label="Inmobiliaria">{contact.agency_name}</InfoRow> : null}

        {contact.phone_number ? (
          <InfoRow label="Teléfono">
            {phoneDigits ? (
              <a
                href={`https://wa.me/${phoneDigits}`}
                target="_blank"
                rel="noreferrer"
                className={CONTACT_LINK_CLASS}
              >
                {contact.phone_number}
              </a>
            ) : (
              contact.phone_number
            )}
          </InfoRow>
        ) : null}

        {contact.email ? (
          <InfoRow label="Email">
            <a href={`mailto:${contact.email}`} className={CONTACT_LINK_CLASS}>
              {contact.email}
            </a>
          </InfoRow>
        ) : null}

        {visibleReasons.length > 0 ? (
          <ul className="text-text-secondary flex list-inside list-disc flex-col gap-1 pt-1 text-sm">
            {visibleReasons.map((reason, index) => (
              <li key={`${reason}-${index}`}>{reason}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </details>
  );
}
