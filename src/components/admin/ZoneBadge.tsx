/**
 * `ZoneBadge` (KAN-240) — port de `zoneBadge()` en `matchouse/src/admin-dashboard/htmlSanitize.js`.
 * En el legacy necesitaba `escapeHtml` manual porque interpolaba HTML crudo (`innerHTML`) — acá
 * no hace falta: JSX escapa texto y atributos automáticamente. Variantes de `Badge` calcadas de
 * `.badge.discrepancy/.none/.text/.point` (matchouse/src/admin-dashboard/style.css).
 */

import type { AdminProperty } from "@/lib/properties-api";
import { Badge } from "@/components/ui/Badge";

export function ZoneBadge({ property }: { property: AdminProperty }) {
  if (property.hasDiscrepancy && property.zone && property.textSuggestedZone) {
    const title = `Punto: ${property.zone.name} | Texto sugiere: ${property.textSuggestedZone.name}`;
    return (
      <Badge variant="warning" title={title}>
        ⚠ {property.zone.name}
      </Badge>
    );
  }

  if (property.zoneSource === "none" || !property.zone) {
    return <Badge variant="error">Sin zona resuelta</Badge>;
  }

  if (property.zoneSource === "text") {
    return <Badge variant="info">{property.zone.name} (por texto)</Badge>;
  }

  return <Badge variant="success">{property.zone.name}</Badge>;
}
