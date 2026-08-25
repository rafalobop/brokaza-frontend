"use client";

import { Building2, LayoutGrid, Search, Sparkles } from "lucide-react";
import { LoginForm } from "@/components/auth/LoginForm";
import { IosInstallBanner } from "@/components/IosInstallBanner";
import { ProfileGate } from "@/components/profile/ProfileGate";
import { PushNotificationButton } from "@/components/PushNotificationButton";
import { DashboardShell } from "@/components/shell/DashboardShell";
import { Loader } from "@/components/ui/Loader";
import { useAuth } from "@/lib/auth-context";
import { MatchesProvider } from "@/lib/matches-context";
import type { SidebarNavItem } from "@/components/shell/Sidebar";

const NAV_ITEMS: SidebarNavItem[] = [
  { label: "Resumen", href: "/", icon: LayoutGrid },
  { label: "Propiedades", href: "/propiedades", icon: Building2 },
  { label: "Matches", href: "/matches", icon: Sparkles, notranslate: true },
  { label: "Búsquedas", href: "/busquedas", icon: Search },
];

/**
 * Layout del grupo de rutas `(dashboard)` — no agrega segmento a la URL (`/`, `/propiedades`,
 * `/matches`, `/busquedas` quedan tal cual). Antes todo esto vivía apilado en un único
 * `app/page.tsx`; ahora el gate de auth/perfil + el shell (sidebar/topbar) se montan una sola
 * vez acá y las 4 rutas hijas comparten `MatchesProvider` (mismo WebSocket/polling, no uno por
 * página — ver `lib/matches-context.tsx`).
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { status, tenant, logout, loggingOut } = useAuth();

  if (status === "loading") {
    return <Loader label="Confirmando tu acceso..." />;
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
          navItems={NAV_ITEMS}
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
