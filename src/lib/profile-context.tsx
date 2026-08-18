"use client";

/**
 * Estado del gate de "perfil completo" (KAN-167).
 *
 * Mismo patrón que `auth-context.tsx` (Context + `useReducer`, sin librería
 * externa — ver justificación en `docs/auth-client-design.md`). Vive en un
 * provider separado, anidado dentro de `AuthProvider`, porque su ciclo de
 * vida depende del `status` de auth: solo tiene sentido consultar
 * `GET /api/profile` una vez que hay sesión, y hay que resetear el estado si
 * el usuario se desloguea (ej. por el interceptor de 401 de KAN-160).
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
import { apiClient, ApiError } from "./api-client";
import { useAuth } from "./auth-context";

export type ProfileStatus = "idle" | "loading" | "complete" | "incomplete" | "error";

export interface TenantProfile {
  id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  agency_name: string | null;
  city: string | null;
  country: string | null;
  profile_completed: boolean;
  created_at: string;
}

interface ProfileState {
  status: ProfileStatus;
  profile: TenantProfile | null;
  error: string | null;
}

type ProfileAction =
  | { type: "RESET" }
  | { type: "LOADING" }
  | { type: "RESOLVED"; profile: TenantProfile }
  | { type: "FAILED"; error: string };

const initialState: ProfileState = { status: "idle", profile: null, error: null };

function profileReducer(state: ProfileState, action: ProfileAction): ProfileState {
  switch (action.type) {
    case "RESET":
      return initialState;
    case "LOADING":
      return { status: "loading", profile: null, error: null };
    case "RESOLVED":
      return {
        status: action.profile.profile_completed ? "complete" : "incomplete",
        profile: action.profile,
        error: null,
      };
    case "FAILED":
      return { status: "error", profile: null, error: action.error };
    default:
      return state;
  }
}

interface ProfileContextValue extends ProfileState {
  /** Vuelve a consultar `/api/profile` (ej. tras guardar el formulario de completar perfil). */
  refresh: () => Promise<void>;
}

const ProfileContext = createContext<ProfileContextValue | null>(null);

interface ProfileResponse {
  profile: TenantProfile;
}

export function ProfileProvider({ children }: { children: ReactNode }) {
  const { status: authStatus } = useAuth();
  const [state, dispatch] = useReducer(profileReducer, initialState);

  const refresh = useCallback(async () => {
    dispatch({ type: "LOADING" });
    try {
      const res = await apiClient<ProfileResponse>("/api/profile");
      dispatch({ type: "RESOLVED", profile: res.profile });
    } catch (error) {
      const message =
        error instanceof ApiError ? error.message : "No pudimos verificar tu perfil.";
      dispatch({ type: "FAILED", error: message });
    }
  }, []);

  useEffect(() => {
    if (authStatus === "authenticated") {
      void refresh();
    } else if (authStatus === "unauthenticated") {
      // Cubre tanto el logout explícito como el deslogueo disparado por el
      // interceptor de 401 (auth-events.ts) — en ambos casos no debe quedar
      // un perfil de una sesión anterior colgando en memoria.
      dispatch({ type: "RESET" });
    }
  }, [authStatus, refresh]);

  const value = useMemo<ProfileContextValue>(() => ({ ...state, refresh }), [state, refresh]);

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): ProfileContextValue {
  const ctx = useContext(ProfileContext);
  if (!ctx) {
    throw new Error("useProfile debe usarse dentro de <ProfileProvider>");
  }
  return ctx;
}
