/**
 * Wrapper de `adminApiClient` para `PATCH /api/properties/:id/coordinates` (KAN-242).
 *
 * Shape tomado de `matchouse/src/adminRoutes.ts` (KAN-130) — el backend no cambia, solo se tipa
 * acá lo que ya devuelve.
 */

import { adminApiClient } from "./admin-api-client";
import type { PropertyZone, PropertyZoneSource } from "./properties-api";

export interface UpdatePropertyCoordinatesResponse {
  success: true;
  latitude: number;
  longitude: number;
  zone: PropertyZone | null;
  zoneSource: PropertyZoneSource;
}

export function updatePropertyCoordinates(
  propertyId: string,
  latitude: number,
  longitude: number,
): Promise<UpdatePropertyCoordinatesResponse> {
  return adminApiClient<UpdatePropertyCoordinatesResponse>(
    `/api/properties/${propertyId}/coordinates`,
    {
      method: "PATCH",
      body: JSON.stringify({ latitude, longitude }),
    },
  );
}
