"use client";

/**
 * Estado global de sesión del tenant (KAN-160/KAN-161), instanciando la factory genérica de
 * `session-context.tsx`. Ver `docs/auth-client-design.md` para el resto del mini-diseño (gate
 * KAN-161).
 */

import { apiClient } from "./api-client";
import { consumeAuthCallbackHash } from "./auth-callback";
import { createSessionContext, SESSION_CHECK_ERROR_MESSAGE } from "./session-context";

export { SESSION_CHECK_ERROR_MESSAGE };

export interface TenantSession {
  id: string;
  email: string;
}

interface SessionResponse {
  authenticated: boolean;
  tenant?: TenantSession;
}

function exchangeTenantToken(accessToken: string): Promise<unknown> {
  return apiClient("/api/auth/exchange-token", {
    method: "POST",
    body: JSON.stringify({ access_token: accessToken }),
  });
}

const { Provider, useSessionContext } = createSessionContext<TenantSession, "tenant">({
  displayName: "Auth",
  sessionKey: "tenant",
  fetchSession: async () => {
    const res = await apiClient<SessionResponse>("/api/auth/session");
    return { authenticated: res.authenticated, session: res.tenant };
  },
  logoutRequest: () => apiClient("/api/auth/logout", { method: "POST" }),
  consumeCallback: () => consumeAuthCallbackHash(exchangeTenantToken),
});

export const AuthProvider = Provider;
export const useAuth = useSessionContext;
