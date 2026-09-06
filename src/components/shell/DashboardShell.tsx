"use client";

import { useState, type ReactNode } from "react";
import { Sidebar, type SidebarNavItem } from "./Sidebar";
import { Topbar } from "./Topbar";
import type { TenantRole } from "@/lib/profile-context";

interface DashboardShellProps {
  brand: string;
  navItems: SidebarNavItem[];
  email: string | undefined;
  /** Opcional: el panel sysadmin (`app/admin/layout.tsx`) reusa este shell sin perfil de tenant. */
  displayName?: string;
  role?: TenantRole;
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
  displayName,
  role,
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
    <div className="bg-background flex h-dvh justify-center overflow-hidden bg-[radial-gradient(640px_circle_at_92%_-8%,var(--shell-glow-a),transparent_65%),radial-gradient(680px_circle_at_-8%_108%,var(--shell-glow-b),transparent_65%)] p-0 md:p-6">
      {/* Los resplandores de marca (glow) detrás del panel translúcido son este `background`
          (ver `--shell-glow-a`/`--shell-glow-b` en globals.css), no elementos en el DOM — así el
          `backdrop-blur` de las cards tiene color/contraste para desenfocar, sin arriesgar el bug
          de un `<div>` absoluto con offset negativo volviendo scrolleable al panel de abajo. */}
      <div className="border-card-border bg-panel md:rounded-radius-lg flex w-full max-w-7xl flex-col overflow-hidden shadow-(--shadow) backdrop-blur-xl md:flex-row md:border">
        <Sidebar
          brand={brand}
          navItems={navItems}
          mobileOpen={mobileNavOpen}
          onMobileClose={() => setMobileNavOpen(false)}
        />
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Topbar
            email={email}
            displayName={displayName}
            role={role}
            onLogout={onLogout}
            loggingOut={loggingOut}
            extraActions={topbarExtraActions}
            onMenuClick={() => setMobileNavOpen(true)}
          />
          {/* `min-h-0`: sin esto, un item de flex-col con overflow-y-auto no se encoge por debajo
              del alto de su contenido (min-height:auto por default) — el scroll interno nunca se
              activa y en su lugar el contenido empuja el layout, que el `overflow-hidden` de más
              arriba recorta en vez de scrollear. En desktop (md:flex-row) el wrapper padre queda
              con alto definido por `stretch` en el eje cruzado y el bug no se nota; en mobile/
              tablet (<md, layout en columna) el alto se resuelve en el eje principal, donde sí
              aplica el min-height:auto por contenido — de ahí que el scroll solo fallara en
              pantallas chicas. */}
          <main className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
