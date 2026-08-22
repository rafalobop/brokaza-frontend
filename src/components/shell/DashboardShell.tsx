"use client";

import { useState, type ReactNode } from "react";
import { Sidebar, type SidebarNavItem } from "./Sidebar";
import { Topbar } from "./Topbar";

interface DashboardShellProps {
  brand: string;
  navItems: SidebarNavItem[];
  email: string | undefined;
  onLogout: () => void;
  loggingOut: boolean;
  topbarExtraActions?: ReactNode;
  children: ReactNode;
}

/**
 * "application_shell" del brief — canvas contenido, centrado, con radio grande y overflow
 * oculto, adentro del cual viven sidebar + workspace (topbar + contenido). Port adaptado de
 * `.app-container` (matchouse/src/dashboard/style.css): mismo panel translúcido con blur, pero
 * ahora con sidebar de navegación real en vez de todo apilado en una sola columna.
 *
 * Dueño del estado del drawer mobile de `Sidebar` — vive acá (no en `Sidebar` ni en `Topbar`)
 * porque el botón que lo abre está en `Topbar` y el panel que lo muestra está en `Sidebar`,
 * hermanos entre sí.
 */
export function DashboardShell({
  brand,
  navItems,
  email,
  onLogout,
  loggingOut,
  topbarExtraActions,
  children,
}: DashboardShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="bg-background flex min-h-screen justify-center p-0 md:p-6">
      <div className="border-card-border bg-panel md:rounded-radius-lg flex w-full max-w-7xl flex-col overflow-hidden shadow-(--shadow) backdrop-blur-xl md:flex-row md:border">
        <Sidebar
          brand={brand}
          navItems={navItems}
          mobileOpen={mobileNavOpen}
          onMobileClose={() => setMobileNavOpen(false)}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            email={email}
            onLogout={onLogout}
            loggingOut={loggingOut}
            extraActions={topbarExtraActions}
            onMenuClick={() => setMobileNavOpen(true)}
          />
          <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
