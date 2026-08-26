"use client";

/**
 * Estado de sesión del panel admin (KAN-239). Mismo patrón que `auth-context.tsx`
 * (Context + `useReducer`, sin librería de estado nueva) pero un Context separado — la sesión de
 * admin tiene una forma distinta (`{ email }`, sin `profile_completed` ni gate de perfil) y su
 * propia cookie/allowlist del lado del backend (`matchouse/src/adminRoutes.ts`,
 * `ADMIN_SESSION_COOKIE`). Ver docs/admin-auth-design.md §3.3.
 *
 * El parsing del callback de magic-link (`consumeAuthCallbackHash`, `auth-callback.ts`) se reusa
 * tal cual del tenant — el mecanismo de Supabase es idéntico, solo cambia a qué endpoint se manda
 * el token (acá, `adminApiClient` en vez de `apiClient`).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { adminApiClient } from "./admin-api-client";
import { ApiError } from "./api-client";
import { consumeAuthCallbackHash } from "./auth-callback";
import { onUnauthorized } from "./auth-events";

const LOGOUT_SUCCESS_MESSAGE = "Cerraste sesión correctamente.";
const SESSION_EXPIRED_MESSAGE = "Tu sesión expiró. Volvé a ingresar.";
export const SESSION_CHECK_ERROR_MESSAGE =
  "No pudimos confirmar tu sesión. Revisá tu conexión e intentá de nuevo.";

export type AdminAuthStatus = "loading" | "authenticated" | "unauthenticated" | "error";

export interface AdminSession {
  email: string;
}

interface AdminAuthState {
  status: AdminAuthStatus;
  admin: AdminSession | null;
}

type AdminAuthAction =
  | { type: "SESSION_LOADING" }
  | { type: "SESSION_RESOLVED"; admin: AdminSession | null }
  | { type: "SESSION_CHECK_FAILED" }
  | { type: "SESSION_CLEARED" };

const initialState: AdminAuthState = { status: "loading", admin: null };

function adminAuthReducer(state: AdminAuthState, action: AdminAuthAction): AdminAuthState {
  switch (action.type) {
    case "SESSION_LOADING":
      return { status: "loading", admin: null };
    case "SESSION_RESOLVED":
      return action.admin
        ? { status: "authenticated", admin: action.admin }
        : { status: "unauthenticated", admin: null };
    case "SESSION_CHECK_FAILED":
      return { status: "error", admin: null };
    case "SESSION_CLEARED":
      return { status: "unauthenticated", admin: null };
    default:
      return state;
  }
}

interface AdminAuthContextValue extends AdminAuthState {
  /** Vuelve a consultar `/admin/api/auth/session` (ej. tras completar el login). */
  refresh: () => Promise<void>;
  /** Best-effort: limpia la sesión local aunque falle la llamada al backend. Reentrante-safe. */
  logout: () => Promise<void>;
  loggingOut: boolean;
  authError: string | null;
  clearAuthError: () => void;
  sessionMessage: string | null;
  clearSessionMessage: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

interface AdminSessionResponse {
  authenticated: boolean;
  admin?: AdminSession;
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(adminAuthReducer, initialState);
  const [authError, setAuthError] = useState<string | null>(null);
  const clearAuthError = useCallback(() => setAuthError(null), []);
  const [sessionMessage, setSessionMessage] = useState<string | null>(null);
  const clearSessionMessage = useCallback(() => setSessionMessage(null), []);

  const statusRef = useRef(state.status);
  useEffect(() => {
    statusRef.current = state.status;
  }, [state.status]);

  const loggingOutRef = useRef(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const refresh = useCallback(async () => {
    dispatch({ type: "SESSION_LOADING" });
    try {
      const res = await adminApiClient<AdminSessionResponse>("/api/auth/session");
      dispatch({
        type: "SESSION_RESOLVED",
        admin: res.authenticated && res.admin ? res.admin : null,
      });
    } catch (error) {
      // Ver el mismo caso en `auth-context.tsx`: un fallo de red/timeout no
      // es "sin sesión", es "no pudimos preguntar".
      if (error instanceof ApiError && (error.kind === "network" || error.kind === "timeout")) {
        dispatch({ type: "SESSION_CHECK_FAILED" });
        return;
      }
      dispatch({ type: "SESSION_RESOLVED", admin: null });
    }
  }, []);

  const logout = useCallback(async () => {
    if (loggingOutRef.current) return;
    loggingOutRef.current = true;
    setLoggingOut(true);
    try {
      await adminApiClient("/api/auth/logout", { method: "POST" });
    } catch {
      // Best-effort — el estado local se limpia igual.
    } finally {
      loggingOutRef.current = false;
      setLoggingOut(false);
    }
    setSessionMessage(LOGOUT_SUCCESS_MESSAGE);
    dispatch({ type: "SESSION_CLEARED" });
  }, []);

  useEffect(() => {
    void (async () => {
      const callbackResult = await consumeAuthCallbackHash(
        (accessToken) =>
          adminApiClient("/api/auth/exchange-token", {
            method: "POST",
            body: JSON.stringify({ access_token: accessToken }),
          }),
        "[ADMIN AUTH]",
      );
      if (callbackResult.error) {
        setAuthError(callbackResult.error);
      }
      await refresh();
    })();
  }, [refresh]);

  useEffect(() => {
    return onUnauthorized(() => {
      if (statusRef.current === "authenticated") {
        setSessionMessage(SESSION_EXPIRED_MESSAGE);
      }
      dispatch({ type: "SESSION_CLEARED" });
    });
  }, []);

  const value = useMemo<AdminAuthContextValue>(
    () => ({
      ...state,
      refresh,
      logout,
      loggingOut,
      authError,
      clearAuthError,
      sessionMessage,
      clearSessionMessage,
    }),
    [
      state,
      refresh,
      logout,
      loggingOut,
      authError,
      clearAuthError,
      sessionMessage,
      clearSessionMessage,
    ],
  );

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth(): AdminAuthContextValue {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) {
    throw new Error("useAdminAuth debe usarse dentro de <AdminAuthProvider>");
  }
  return ctx;
}
