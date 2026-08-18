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
  useState,
  type ReactNode,
} from "react";
import { apiClient } from "./api-client";
import { onUnauthorized } from "./auth-events";

const EXPIRED_LINK_MESSAGE =
  "Tu link de acceso expiró o ya fue usado. Ingresá tu email para solicitar uno nuevo.";
const INVALID_LINK_MESSAGE =
  "El link de acceso no es válido. Ingresá tu email para solicitar uno nuevo.";

/**
 * Parsing del callback de magic-link (KAN-166), portado de
 * `handleMagicLinkCallback`/`handleAuthErrorCallback` del dashboard legacy
 * (`src/dashboard/app.js` líneas 403-457). El link de Supabase siempre
 * redirige a la raíz de `APP_URL` con el token/error en el hash — nunca a
 * un path aparte — así que esto vive en `AuthProvider` (se monta en la raíz
 * del árbol) en vez de en una ruta dedicada. Ver `docs/magic-link-flow-design.md`.
 */
async function consumeAuthCallbackHash(
  logTag = "[AUTH]",
): Promise<{ exchanged: boolean; error: string | null }> {
  if (typeof window === "undefined") return { exchanged: false, error: null };

  const hash = window.location.hash;
  if (!hash) return { exchanged: false, error: null };

  const params = new URLSearchParams(hash.replace(/^#/, ""));

  const errorCode = params.get("error_code");
  if (hash.includes("error=")) {
    window.history.replaceState(null, "", window.location.pathname);
    console.warn(
      `${logTag} El link de acceso llegó con un error:`,
      errorCode,
      params.get("error_description"),
    );
    return {
      exchanged: false,
      error: errorCode === "otp_expired" ? EXPIRED_LINK_MESSAGE : INVALID_LINK_MESSAGE,
    };
  }

  const accessToken = params.get("access_token");
  if (!hash.includes("access_token=") || !accessToken) {
    return { exchanged: false, error: null };
  }

  window.history.replaceState(null, "", window.location.pathname);
  console.log(`${logTag} Magic link callback detectado, intercambiando token...`);
  try {
    await apiClient("/api/auth/exchange-token", {
      method: "POST",
      body: JSON.stringify({ access_token: accessToken }),
    });
    console.log(`${logTag} Token intercambiado correctamente, sesión iniciada.`);
    return { exchanged: true, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al intercambiar el token.";
    console.error(`${logTag} Fallo al intercambiar token:`, message);
    return { exchanged: false, error: message };
  }
}

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
  /**
   * Mensaje del callback de magic-link (KAN-166) — link vencido/inválido, o
   * fallo al intercambiar el token. Transitorio y de UI, no forma parte del
   * modelo de sesión en sí (por eso no vive en el reducer). `LoginForm` lo
   * muestra en el paso 1 al montar.
   */
  authError: string | null;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

interface SessionResponse {
  authenticated: boolean;
  tenant?: TenantSession;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const [authError, setAuthError] = useState<string | null>(null);
  const clearAuthError = useCallback(() => setAuthError(null), []);

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
    void (async () => {
      const callbackResult = await consumeAuthCallbackHash();
      if (callbackResult.error) {
        setAuthError(callbackResult.error);
      }
      // Si hubo un exchange exitoso, este refresh() ya levanta la sesión
      // recién creada; si no, es el bootstrap normal sin cambios.
      await refresh();
    })();
  }, [refresh]);

  useEffect(() => {
    return onUnauthorized(() => dispatch({ type: "SESSION_CLEARED" }));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ ...state, refresh, logout, authError, clearAuthError }),
    [state, refresh, logout, authError, clearAuthError],
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
