"use client";

/**
 * Estado de sesión del panel admin (KAN-239), instanciando la factory genérica de
 * `session-context.tsx`. Mismo patrón que `auth-context.tsx` (tenant) pero un Context separado —
 * la sesión de admin tiene una forma distinta (`{ email }`, sin `profile_completed` ni gate de
 * perfil) y su propia cookie/allowlist del lado del backend (`matchouse/src/adminRoutes.ts`,
 * `ADMIN_SESSION_COOKIE`). Ver docs/admin-auth-design.md §3.3.
 *
 * KAN-342: a diferencia del tenant (que sigue con `consumeAuthCallbackHash`, el redirect hosteado
 * de Supabase con el token en el fragment `#access_token=...`), el admin usa
 * `consumeAuthCallbackQuery` — un link propio (`?token_hash=...&type=magiclink`, armado por
 * `matchouse/src/adminRoutes.ts`) que se canjea llamando a `exchange-token`, sin pasar por el
 * redirect de Supabase en ningún momento (evita depender del allow-list de "Redirect URLs" de su
 * dashboard, que es lo que rompía el login de admin antes de este cambio).
 */

import { adminApiClient } from "./admin-api-client";
import { consumeAuthCallbackQuery } from "./auth-callback";
import { createSessionContext, SESSION_CHECK_ERROR_MESSAGE } from "./session-context";

export { SESSION_CHECK_ERROR_MESSAGE };

export interface AdminSession {
  email: string;
}

interface AdminSessionResponse {
  authenticated: boolean;
  admin?: AdminSession;
}

const { Provider, useSessionContext } = createSessionContext<AdminSession, "admin">({
  displayName: "AdminAuth",
  sessionKey: "admin",
  fetchSession: async () => {
    const res = await adminApiClient<AdminSessionResponse>("/api/auth/session");
    return { authenticated: res.authenticated, session: res.admin };
  },
  logoutRequest: () => adminApiClient("/api/auth/logout", { method: "POST" }),
  consumeCallback: () =>
    consumeAuthCallbackQuery(
      ({ token_hash, type }) =>
        adminApiClient("/api/auth/exchange-token", {
          method: "POST",
          body: JSON.stringify({ token_hash, type }),
        }),
      "[ADMIN AUTH]",
    ),
});

export const AdminAuthProvider = Provider;
export const useAdminAuth = useSessionContext;
