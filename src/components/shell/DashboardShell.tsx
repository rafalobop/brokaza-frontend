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
    // `h-dvh` (no `h-screen`/`min-h-screen`): `h-screen` (100vh) mide el viewport "largo" de
    // mobile (con la barra de direcciones oculta), más alto que el área visible real cuando la
    // barra está mostrada — con `overflow-hidden` en este nodo y en el panel de abajo, esa
    // franja de más queda recortada y con ella el gesto de swipe que debería llegar a `main`
    // (KAN-301: "no funciona el scroll en pantallas mobile"). `h-dvh` seguí una altura fija
    // (mismo motivo que el comentario original: sin altura fija acá, `main` no tiene contra qué
    // recortar y crece con el contenido) pero recalculada al viewport visible real en cada
    // resize del navegador (`dvh` = dynamic viewport height), así el área tocable de `main`
    // siempre coincide con lo que el usuario ve.
    <div className="bg-background flex h-dvh justify-center overflow-hidden p-0 md:p-6">
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
