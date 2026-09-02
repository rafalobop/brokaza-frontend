"use client";

import { Building2, LayoutGrid, Search, Sparkles, Users } from "lucide-react";
import { LoginForm } from "@/components/auth/LoginForm";
import { IosInstallBanner } from "@/components/IosInstallBanner";
import { ProfileGate } from "@/components/profile/ProfileGate";
import { PushNotificationButton } from "@/components/PushNotificationButton";
import { DashboardShell } from "@/components/shell/DashboardShell";
import { Loader } from "@/components/ui/Loader";
import { SESSION_CHECK_ERROR_MESSAGE, useAuth } from "@/lib/auth-context";
import { useProfile } from "@/lib/profile-context";
import { MatchesProvider } from "@/lib/matches-context";
import type { SidebarNavItem } from "@/components/shell/Sidebar";

const BASE_NAV_ITEMS: SidebarNavItem[] = [
  { label: "Resumen", href: "/", icon: LayoutGrid },
  { label: "Propiedades", href: "/propiedades", icon: Building2 },
  { label: "Matches", href: "/matches", icon: Sparkles, notranslate: true },
  { label: "Búsquedas", href: "/busquedas", icon: Search },
];

// KAN-306: "Equipo" solo tiene sentido para un dueño de agencia (`profile.role === "owner"`) —
// un colaborador no tiene nada para gestionar ahí (el backend le devuelve 403 igual, esto es la
// primera capa, no la única — ver TeamSection para la segunda).
const TEAM_NAV_ITEM: SidebarNavItem = { label: "Equipo", href: "/equipo", icon: Users };

/**
 * Layout del grupo de rutas `(dashboard)` — no agrega segmento a la URL (`/`, `/propiedades`,
 * `/matches`, `/busquedas` quedan tal cual). Antes todo esto vivía apilado en un único
 * `app/page.tsx`; ahora el gate de auth/perfil + el shell (sidebar/topbar) se montan una sola
 * vez acá y las 4 rutas hijas comparten `MatchesProvider` (mismo WebSocket/polling, no uno por
 * página — ver `lib/matches-context.tsx`).
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { status, tenant, logout, loggingOut, refresh } = useAuth();
  // KAN-306: `useProfile()` ya está disponible acá aunque `ProfileProvider` se monte más abajo en
  // el árbol (en `app/layout.tsx`, junto a `AuthProvider`) — mismo criterio que el resto de este
  // componente, que ya lee `useAuth()` sin ser el propio provider.
  const { profile } = useProfile();
  const navItems = profile?.role === "owner" ? [...BASE_NAV_ITEMS, TEAM_NAV_ITEM] : BASE_NAV_ITEMS;

  if (status === "loading") {
    return <Loader label="Confirmando tu acceso..." />;
  }

  if (status === "error") {
    return (
      <div className="bg-background flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-error text-sm">{SESSION_CHECK_ERROR_MESSAGE}</p>
        <button
          type="button"
          onClick={() => void refresh()}
          className="text-sm font-medium underline underline-offset-4"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="bg-background flex flex-1 flex-col items-center justify-center gap-6 px-6">
        <LoginForm />
      </div>
    );
  }

  return (
    <ProfileGate>
      <MatchesProvider>
        <DashboardShell
          brand="Brokaza"
          navItems={navItems}
          email={tenant?.email}
          onLogout={() => void logout()}
          loggingOut={loggingOut}
          topbarExtraActions={<PushNotificationButton enabled={status === "authenticated"} />}
        >
          <IosInstallBanner />
          <div className="pt-4">{children}</div>
        </DashboardShell>
      </MatchesProvider>
    </ProfileGate>
  );
}
