"use client";

/**
 * Estado global de sesión (KAN-160/KAN-161).
 *
 * Context API + `useReducer` nativos de React — sin Zustand/Redux/Jotai. El
 * estado es chico (status + datos del tenant), vive en un único provider en
 * la raíz del árbol, y no necesita selectors granulares ni persistencia
 * compleja que justifiquen una dependencia nueva. Ver
 * `docs/auth-client-design.md` para el resto del mini-diseño (gate KAN-161).
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type ReactNode,
} from "react";
import { apiClient } from "./api-client";
import { onUnauthorized } from "./auth-events";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

export interface TenantSession {
  id: string;
  email: string;
}

interface AuthState {
  status: AuthStatus;
  tenant: TenantSession | null;
}

type AuthAction =
  | { type: "SESSION_LOADING" }
  | { type: "SESSION_RESOLVED"; tenant: TenantSession | null }
  | { type: "SESSION_CLEARED" };

const initialState: AuthState = { status: "loading", tenant: null };

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case "SESSION_LOADING":
      return { status: "loading", tenant: null };
    case "SESSION_RESOLVED":
      return action.tenant
        ? { status: "authenticated", tenant: action.tenant }
        : { status: "unauthenticated", tenant: null };
    case "SESSION_CLEARED":
      return { status: "unauthenticated", tenant: null };
    default:
      return state;
  }
}

interface AuthContextValue extends AuthState {
  /** Vuelve a consultar `/api/auth/session` (ej. tras completar el login). */
  refresh: () => Promise<void>;
  /** Best-effort: limpia la sesión local aunque falle la llamada al backend. */
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface SessionResponse {
  authenticated: boolean;
  tenant?: TenantSession;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  const refresh = useCallback(async () => {
    dispatch({ type: "SESSION_LOADING" });
    try {
      const res = await apiClient<SessionResponse>("/api/auth/session");
      dispatch({
        type: "SESSION_RESOLVED",
        tenant: res.authenticated && res.tenant ? res.tenant : null,
      });
    } catch {
      // `/api/auth/session` no debería tirar en uso normal (siempre devuelve
      // 200), pero ante un error de red real no hay que dejar el estado
      // colgado en "loading" para siempre.
      dispatch({ type: "SESSION_RESOLVED", tenant: null });
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiClient("/api/auth/logout", { method: "POST" });
    } catch {
      // Best-effort, igual que `apiFetch('/api/auth/logout', ...).catch()`
      // en el admin legacy — el estado local se limpia igual.
    }
    dispatch({ type: "SESSION_CLEARED" });
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    return onUnauthorized(() => dispatch({ type: "SESSION_CLEARED" }));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, refresh, logout }),
    [state, refresh, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  }
  return ctx;
}
