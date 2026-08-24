/**
 * Tipos + wrappers de `apiClient` para el CRUD de propiedades del propio tenant (KAN-273):
 * `GET/POST/PATCH/DELETE /api/catalog/properties(/:id)` (`matchouse/src/routes/properties.ts`).
 *
 * No confundir con `properties-api.ts`/`use-properties.ts` (KAN-240): esos son del panel ADMIN
 * (`GET /api/properties`, cross-tenant, solo lectura + corrección de coordenadas). Este módulo es
 * el catálogo propio del tenant autenticado (`/api/catalog/properties`) — endpoints, tenant y
 * shape de datos completamente distintos, ver la nota de prefijo en `properties.ts` (colisión de
 * paths con la ruta admin, ya existente antes que esta).
 */

import { apiClient } from "./api-client";

export type PropertyOperation = "venta" | "alquiler" | "compra";
export type PropertyType = "departamento" | "casa" | "terreno" | "local" | "oficina" | "otro";
export type PropertyCurrency = "USD" | "ARS";

export const OPERATIONS: PropertyOperation[] = ["venta", "alquiler", "compra"];
export const PROPERTY_TYPES: PropertyType[] = [
  "departamento",
  "casa",
  "terreno",
  "local",
  "oficina",
  "otro",
];
export const CURRENCIES: PropertyCurrency[] = ["USD", "ARS"];

export const OPERATION_LABELS: Record<PropertyOperation, string> = {
  venta: "Venta",
  alquiler: "Alquiler",
  compra: "Compra",
};

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  departamento: "Departamento",
  casa: "Casa",
  terreno: "Terreno",
  local: "Local",
  oficina: "Oficina",
  otro: "Otro",
};

export interface TenantProperty {
  id: string;
  address: string;
  floor: string | null;
  unit: string | null;
  block: string | null;
  lot: string | null;
  price: number;
  currency: PropertyCurrency;
  maintenance_fees: number;
  bedrooms: number;
  features: string | null;
  contact_info: string | null;
  operation: PropertyOperation;
  property_type: PropertyType;
  sheet_name: string;
  latitude: number | null;
  longitude: number | null;
  /** Zona resuelta server-side (KAN-85, `neighborhoods`) a partir de lat/lng — `null` si la
   * propiedad no tiene coordenadas o no cae dentro/cerca de ninguna zona conocida. */
  zone: { id: string; name: string } | null;
  created_at: string;
  updated_at: string;
}

export type SortableField =
  | "address"
  | "price"
  | "currency"
  | "bedrooms"
  | "operation"
  | "property_type"
  | "maintenance_fees"
  | "created_at"
  | "updated_at";

export type SortOrder = "asc" | "desc";

export interface GetTenantPropertiesParams {
  operation?: PropertyOperation;
  property_type?: PropertyType;
  search?: string;
  sort?: SortableField;
  order?: SortOrder;
  limit?: number;
  offset?: number;
}

export interface TenantPropertiesResponse {
  properties: TenantProperty[];
  total: number;
}

export function getTenantProperties(
  params: GetTenantPropertiesParams = {},
): Promise<TenantPropertiesResponse> {
  const query = new URLSearchParams();
  if (params.operation) query.set("operation", params.operation);
  if (params.property_type) query.set("property_type", params.property_type);
  if (params.search) query.set("search", params.search);
  if (params.sort) query.set("sort", params.sort);
  if (params.order) query.set("order", params.order);
  query.set("limit", String(params.limit ?? 50));
  query.set("offset", String(params.offset ?? 0));
  return apiClient<TenantPropertiesResponse>(`/api/catalog/properties?${query.toString()}`);
}

/** Campos aceptados por `POST /api/catalog/properties` — mismo `CREATE_FIELDS` del backend. */
export interface CreatePropertyInput {
  address: string;
  floor?: string | null;
  unit?: string | null;
  block?: string | null;
  lot?: string | null;
  price: number;
  currency: PropertyCurrency;
  maintenance_fees?: number;
  bedrooms?: number;
  features?: string | null;
  contact_info?: string | null;
  operation: PropertyOperation;
  property_type: PropertyType;
  latitude?: number | null;
  longitude?: number | null;
}

export function createTenantProperty(
  input: CreatePropertyInput,
): Promise<{ property: TenantProperty }> {
  return apiClient<{ property: TenantProperty }>("/api/catalog/properties", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

/**
 * Campos editables + `expectedUpdatedAt` (el `updated_at` visto al leer la fila, token de
 * concurrencia optimista — ver `PATCH /api/catalog/properties/:id` en el backend). Si otra edición
 * ya pasó, `apiClient` lanza `ApiError` con `status: 409` y `body.property` trae el estado real
 * actual — el caller (`useTenantProperties`) lo usa para reconciliar la fila en la UI.
 */
export type UpdatePropertyInput = Partial<CreatePropertyInput> & { expectedUpdatedAt: string };

export function updateTenantProperty(
  id: string,
  input: UpdatePropertyInput,
): Promise<{ property: TenantProperty }> {
  return apiClient<{ property: TenantProperty }>(`/api/catalog/properties/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
}

export function deleteTenantProperty(id: string): Promise<{ success: true }> {
  return apiClient<{ success: true }>(`/api/catalog/properties/${id}`, { method: "DELETE" });
}
