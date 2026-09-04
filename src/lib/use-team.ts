"use client";

/**
 * Hook `useTeam` (KAN-306) — estado de datos de la sección "Equipo": `GET /api/admin-panel/collaborators`
 * + invitar/revocar. Mismo criterio de `use-active-searches.ts` (estado local, sin store global).
 *
 * `"forbidden"` es un status propio (no `"error"`) para el caso 403 — un `role: "collaborator"`
 * que llega a esta página por la URL directa, no por el nav (que ya lo oculta vía
 * `profile.role`). Distinguirlo permite mostrar un mensaje explicativo en vez del banner de error
 * genérico.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError } from "./api-client";
import { getCollaborators, reactivateCollaborator, revokeCollaborator, type Collaborator } from "./team-api";

export type TeamStatus = "loading" | "loaded" | "forbidden" | "error";

export interface UseTeamResult {
  status: TeamStatus;
  collaborators: Collaborator[];
  error: string | null;
  refetch: () => Promise<void>;
  revoke: (collaboratorId: string) => Promise<void>;
  reactivate: (collaboratorId: string) => Promise<void>;
}

export function useTeam(): UseTeamResult {
  const [status, setStatus] = useState<TeamStatus>("loading");
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Mismo guard que `useActiveSearches`/`useMatches`.
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refetch = useCallback(async () => {
    try {
      const res = await getCollaborators();
      if (!isMountedRef.current) return;
      setCollaborators(res.collaborators);
      setStatus("loaded");
      setError(null);
    } catch (err) {
      if (!isMountedRef.current) return;
      if (err instanceof ApiError && err.status === 403) {
        setStatus("forbidden");
        setError(err.message);
        return;
      }
      const message = err instanceof ApiError ? err.message : "Error al obtener el equipo.";
      setError(message);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await refetch();
    })();
  }, [refetch]);

  // `revoke` no atrapa el error acá: lo deja propagarse para que `CollaboratorRow` muestre el
  // mensaje puntual de esa fila sin pisar el resto de la lista — mismo criterio que
  // `PropertyRow`/`ActiveSearchItem`. La invitación no vive acá: `InviteCollaboratorForm` llama a
  // `inviteCollaborator` directo (mismo criterio que `NewSearchForm` con `submitSearch`) y solo
  // usa `refetch` como señal de "algo cambió", sin pasar por un wrapper del hook.
  const revoke = useCallback(
    async (collaboratorId: string) => {
      await revokeCollaborator(collaboratorId);
      await refetch();
    },
    [refetch],
  );

  // Mismo criterio que `revoke`: no atrapa el error, lo deja propagarse para que la fila
  // muestre el mensaje puntual sin pisar el resto de la lista.
  const reactivate = useCallback(
    async (collaboratorId: string) => {
      await reactivateCollaborator(collaboratorId);
      await refetch();
    },
    [refetch],
  );

  return { status, collaborators, error, refetch, revoke, reactivate };
}
