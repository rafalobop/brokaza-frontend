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

// KAN-306: "pending_validation" — perfil guardado (incluye `license_number`) pero
// `profile_completed=false` porque el backend no pudo confirmar la matrícula todavía (padrón
// desactualizado, "registro temporal" del AC5). Distinto de "incomplete" (nunca se completó el
// formulario, o la matrícula fue rechazada) porque no tiene sentido volver a mostrar el mismo
// formulario — no hay nada más que el agente pueda hacer salvo esperar.
export type ProfileStatus =
  "idle" | "loading" | "complete" | "incomplete" | "pending_validation" | "error";

// KAN-306: estado real de la validación de matrícula contra el padrón de matriculados (backend,
// `matchouse/src/services/licenseRegistry.ts`). 'rejected' deja `profile_completed=false` igual
// que un perfil nunca completado — se mapea a `status: "incomplete"` (mismo formulario, para que
// el agente pueda corregir el número e intentar de nuevo).
export type LicenseValidationStatus = "validated" | "pending" | "rejected";

export type TenantRole = "owner" | "collaborator";

export interface TenantProfile {
  id: string;
  full_name: string;
  email: string;
  phone_number: string | null;
  agency_name: string | null;
  city: string | null;
  country: string | null;
  profile_completed: boolean;
  license_number: string | null;
  license_validation_status: LicenseValidationStatus;
  role: TenantRole;
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
    case "RESOLVED": {
      // KAN-306 (fix QA): `license_validation_status` tiene DEFAULT 'pending' en la base — TODO
      // perfil recién creado (antes de tocar el formulario, `license_number` todavía null) ya
      // trae 'pending', no solo el caso real de AC5 (formulario enviado, padrón desactualizado).
      // Sin el chequeo de `license_number !== null` acá, cualquier cuenta nueva caía directo en
      // "pending_validation" (pantalla de espera) sin haber visto nunca `CompleteProfileForm` —
      // bloqueaba el 100% del registro. Confirmado con `GET /api/profile` real contra un tenant
      // recién creado por magic link.
      let status: ProfileStatus;
      if (action.profile.profile_completed) {
        status = "complete";
      } else if (
        action.profile.license_validation_status === "pending" &&
        action.profile.license_number !== null
      ) {
        status = "pending_validation";
      } else {
        status = "incomplete";
      }
      return { status, profile: action.profile, error: null };
    }
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
      const message = error instanceof ApiError ? error.message : "No pudimos verificar tu perfil.";
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
