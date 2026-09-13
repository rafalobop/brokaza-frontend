"use client";

/**
 * Factory genérica de contexto de sesión (KAN-160/KAN-161/KAN-239). Extraída de
 * `auth-context.tsx` y `admin-auth-context.tsx`, que reimplementaban el mismo reducer +
 * refs + `refresh`/`logout` + wiring de magic-link con la única diferencia real de qué
 * endpoint pegar y cómo se llama el campo de sesión en el value (`tenant` vs `admin`). Cada
 * caller instancia esto una vez con su propio `fetchSession`/`logoutRequest`/`consumeCallback`
 * y obtiene su `Provider`/hook con el nombre de campo que le corresponde — ver
 * `docs/auth-client-design.md` para el resto del mini-diseño.
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
import { ApiError } from "./api-client";
import { onUnauthorized } from "./auth-events";

const LOGOUT_SUCCESS_MESSAGE = "Cerraste sesión correctamente.";
const SESSION_EXPIRED_MESSAGE = "Tu sesión expiró. Volvé a ingresar.";
export const SESSION_CHECK_ERROR_MESSAGE =
  "No pudimos confirmar tu sesión. Revisá tu conexión e intentá de nuevo.";

export type SessionStatus = "loading" | "authenticated" | "unauthenticated" | "error";

interface SessionState<TSession> {
  status: SessionStatus;
  session: TSession | null;
}

type SessionAction<TSession> =
  | { type: "SESSION_LOADING" }
  | { type: "SESSION_RESOLVED"; session: TSession | null }
  | { type: "SESSION_CHECK_FAILED" }
  | { type: "SESSION_CLEARED" };

function sessionReducer<TSession>(
  state: SessionState<TSession>,
  action: SessionAction<TSession>,
): SessionState<TSession> {
  switch (action.type) {
    case "SESSION_LOADING":
      return { status: "loading", session: null };
    case "SESSION_RESOLVED":
      return action.session
        ? { status: "authenticated", session: action.session }
        : { status: "unauthenticated", session: null };
    case "SESSION_CHECK_FAILED":
      return { status: "error", session: null };
    case "SESSION_CLEARED":
      return { status: "unauthenticated", session: null };
    default:
      return state;
  }
}

export interface SessionContextConfig<TSession> {
  /** Nombre para mensajes de error (ej. "Auth" -> "useAuth debe usarse dentro de <AuthProvider>"). */
  displayName: string;
  /** Nombre de campo expuesto en el value del hook (ej. "tenant" | "admin"). */
  sessionKey: string;
  fetchSession: () => Promise<{ authenticated: boolean; session?: TSession }>;
  logoutRequest: () => Promise<unknown>;
  /** Corre al montar el provider, antes del primer `refresh()` (consume el callback del magic link). */
  consumeCallback: () => Promise<{ error: string | null }>;
}

export interface BaseSessionContextValue {
  status: SessionStatus;
  /** Vuelve a consultar el endpoint de sesión (ej. tras completar el login). */
  refresh: () => Promise<void>;
  /**
   * Best-effort: limpia la sesión local aunque falle la llamada al backend. Reentrante-safe
   * (KAN-168): si ya hay un logout en curso, las invocaciones adicionales (ej. doble click) son
   * un no-op — no se duplica la llamada al backend ni se pisa el resultado del primer intento.
   */
  logout: () => Promise<void>;
  /** `true` mientras `logout()` tiene una llamada de red en curso. */
  loggingOut: boolean;
  /**
   * Mensaje del callback de magic-link (KAN-166) — link vencido/inválido, o fallo al intercambiar
   * el token. Transitorio y de UI, no forma parte del modelo de sesión en sí (por eso no vive en
   * el reducer). El form de login lo muestra al montar.
   */
  authError: string | null;
  clearAuthError: () => void;
  /**
   * Mensaje transitorio (KAN-168) que explica por qué el usuario terminó de vuelta en el login:
   * cierre de sesión manual exitoso, o expiración detectada por el interceptor de 401
   * (`auth-events.ts`) en medio de una sesión activa. Igual que `authError`, es UI, no estado de
   * sesión.
   */
  sessionMessage: string | null;
  clearSessionMessage: () => void;
}

export function createSessionContext<TSession, TSessionKey extends string>(
  config: SessionContextConfig<TSession> & { sessionKey: TSessionKey },
) {
  const { displayName, sessionKey, fetchSession, logoutRequest, consumeCallback } = config;

  type SessionContextValue = BaseSessionContextValue & { [K in TSessionKey]: TSession | null };

  const Context = createContext<SessionContextValue | null>(null);

  function Provider({ children }: { children: ReactNode }) {
    const [state, dispatch] = useReducer(sessionReducer<TSession>, {
      status: "loading",
      session: null,
    });
    const [authError, setAuthError] = useState<string | null>(null);
    const clearAuthError = useCallback(() => setAuthError(null), []);
    const [sessionMessage, setSessionMessage] = useState<string | null>(null);
    const clearSessionMessage = useCallback(() => setSessionMessage(null), []);

    // Ref en vez de leer `state.status` directo dentro del listener de 401: ese listener se
    // suscribe una sola vez al montar y necesita el status *actual* en el momento del evento, no
    // el que tenía cuando se suscribió.
    const statusRef = useRef(state.status);
    useEffect(() => {
      statusRef.current = state.status;
    }, [state.status]);

    // Ídem con un ref (no `useState`) para el guard de logout concurrente (KAN-168, AC "sesiones
    // concurrentes"): necesita leerse y escribirse de forma sincrónica antes del primer `await`,
    // algo que `useState` no garantiza entre renders.
    const loggingOutRef = useRef(false);
    const [loggingOut, setLoggingOut] = useState(false);

    const refresh = useCallback(async () => {
      dispatch({ type: "SESSION_LOADING" });
      try {
        const res = await fetchSession();
        dispatch({
          type: "SESSION_RESOLVED",
          session: res.authenticated && res.session ? res.session : null,
        });
      } catch (error) {
        // Un fallo de red/timeout acá no significa "no autenticado" — significa que no pudimos
        // preguntar. Tratarlo como `unauthenticated` mandaba al usuario al login de forma
        // indistinguible de un logout real. Solo un 4xx/5xx real del endpoint de sesión (que en
        // uso normal no debería pasar, siempre devuelve 200) cae al mismo lado que "sin sesión".
        if (error instanceof ApiError && (error.kind === "network" || error.kind === "timeout")) {
          dispatch({ type: "SESSION_CHECK_FAILED" });
          return;
        }
        dispatch({ type: "SESSION_RESOLVED", session: null });
      }
    }, []);

    const logout = useCallback(async () => {
      // Doble click / doble invocación mientras ya hay un logout en curso: no se dispara una
      // segunda llamada de logout ni se pisa el resultado del primer intento (KAN-168).
      if (loggingOutRef.current) return;
      loggingOutRef.current = true;
      setLoggingOut(true);
      try {
        await logoutRequest();
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
        const callbackResult = await consumeCallback();
        if (callbackResult.error) {
          setAuthError(callbackResult.error);
        }
        // Si hubo un exchange exitoso, este refresh() ya levanta la sesión recién creada; si no,
        // es el bootstrap normal sin cambios.
        await refresh();
      })();
    }, [refresh]);

    useEffect(() => {
      return onUnauthorized(() => {
        // Solo es una "expiración de sesión" real si el usuario todavía se creía autenticado — el
        // propio endpoint de logout no requiere auth (no dispara este listener él mismo), pero un
        // 401 disparado por cualquier otra llamada mientras ya está `unauthenticated`/`loading`
        // no debería pisar un mensaje distinto que ya esté mostrándose (ej. un logout manual que
        // terminó un instante antes).
        if (statusRef.current === "authenticated") {
          setSessionMessage(SESSION_EXPIRED_MESSAGE);
        }
        dispatch({ type: "SESSION_CLEARED" });
      });
    }, []);

    const value = useMemo(
      () =>
        ({
          status: state.status,
          [sessionKey]: state.session,
          refresh,
          logout,
          loggingOut,
          authError,
          clearAuthError,
          sessionMessage,
          clearSessionMessage,
        }) as SessionContextValue,
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

    return <Context.Provider value={value}>{children}</Context.Provider>;
  }

  function useSessionContext(): SessionContextValue {
    const ctx = useContext(Context);
    if (!ctx) {
      throw new Error(`use${displayName} debe usarse dentro de <${displayName}Provider>`);
    }
    return ctx;
  }

  return { Provider, useSessionContext };
}
