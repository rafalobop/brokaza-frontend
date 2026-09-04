/**
 * Tipos + wrappers de `apiClient` para el panel de administración de agencia (KAN-306):
 * `GET/POST/DELETE /api/admin-panel/collaborators` (backend,
 * `matchouse/src/controllers/adminPanelController.ts`). Solo un tenant con `role: "owner"` puede
 * usar estos endpoints — un `role: "collaborator"` recibe 403, que el hook (`use-team.ts`)
 * traduce a un estado `"forbidden"` distinto de `"error"`.
 *
 * Distinto de `admin-api-client.ts`: ese es el cliente del panel de sysadmin cross-tenant
 * (`/admin`, `adminAuthMiddleware`) — no tiene relación con este panel por-agencia, que usa el
 * mismo `apiClient`/sesión de tenant que el resto del dashboard.
 */

import { apiClient } from "./api-client";
import type { LicenseValidationStatus } from "./profile-context";

// KAN-306 (pase de UI, 2026-09-04): estado real de acceso del colaborador, independiente de
// `license_validation_status` (que un colaborador nunca deja de tener en 'pending' porque no
// pasa por esa validación — no sirve para pintar su estado real en el panel). `null` no debería
// verse acá (todo lo que devuelve `GET /api/admin-panel/collaborators` es, por definición, un
// colaborador), pero el tipo lo permite porque la columna es nullable a nivel de base.
export type CollaboratorStatus = "active" | "revoked" | null;

export interface Collaborator {
  id: string;
  full_name: string;
  email: string;
  license_number: string | null;
  license_validation_status: LicenseValidationStatus;
  profile_completed: boolean;
  collaborator_status: CollaboratorStatus;
  created_at: string;
}

interface CollaboratorsResponse {
  collaborators: Collaborator[];
}

export function getCollaborators(): Promise<CollaboratorsResponse> {
  return apiClient<CollaboratorsResponse>("/api/admin-panel/collaborators");
}

interface InviteCollaboratorResponse {
  success: true;
  collaborator: Collaborator;
}

export function inviteCollaborator(email: string): Promise<InviteCollaboratorResponse> {
  return apiClient<InviteCollaboratorResponse>("/api/admin-panel/collaborators", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export function revokeCollaborator(collaboratorId: string): Promise<{ success: true }> {
  return apiClient<{ success: true }>(`/api/admin-panel/collaborators/${collaboratorId}`, {
    method: "DELETE",
  });
}

interface ReactivateCollaboratorResponse {
  success: true;
  collaborator: Collaborator;
}

export function reactivateCollaborator(collaboratorId: string): Promise<ReactivateCollaboratorResponse> {
  return apiClient<ReactivateCollaboratorResponse>(
    `/api/admin-panel/collaborators/${collaboratorId}/reactivate`,
    { method: "POST" },
  );
}
