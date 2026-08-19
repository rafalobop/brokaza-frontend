/**
 * Wrapper mínimo sobre `apiClient` (KAN-155) para el panel admin (KAN-239).
 *
 * El AC real detrás de "reusando el cliente unificado": no se reimplementa timeout/abort/parsing
 * de JSON/manejo de 401 — todo eso lo sigue resolviendo `apiClient`. El único costo es anteponer
 * `/admin` al path, que es lo que el rewrite de `next.config.ts` usa para enrutar hacia
 * `ADMIN_BACKEND_ORIGIN` en vez del backend de tenants (ver docs/admin-auth-design.md §3.1).
 */

import { apiClient, type ApiClientOptions } from "./api-client";

export function adminApiClient<T = unknown>(
  path: string,
  options?: ApiClientOptions,
): Promise<T> {
  return apiClient<T>(`/admin${path}`, options);
}
