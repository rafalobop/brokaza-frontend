"use client";

import { Building2, LayoutGrid } from "lucide-react";
import { AdminAuthProvider, useAdminAuth } from "@/lib/admin-auth-context";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
import { DashboardShell } from "@/components/shell/DashboardShell";
import { Loader } from "@/components/ui/Loader";
import type { SidebarNavItem } from "@/components/shell/Sidebar";

const NAV_ITEMS: SidebarNavItem[] = [
  { label: "Resumen", href: "/admin", icon: LayoutGrid },
  { label: "Propiedades", href: "/admin/propiedades", icon: Building2 },
];

/**
 * Layout de `/admin` (KAN-239) — scoped a este subárbol, no al layout raíz: el tenant y el admin
 * nunca comparten sesión ni Provider (ver docs/admin-auth-design.md §3.4). Con el shell nuevo
 * (sidebar + topbar), el gate de auth y el `DashboardShell` se montan acá una sola vez para las
 * rutas hijas (`/admin`, `/admin/propiedades`) — mismo criterio que `app/(dashboard)/layout.tsx`
 * del lado tenant.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminAuthProvider>
      <AdminChrome>{children}</AdminChrome>
    </AdminAuthProvider>
  );
}

function AdminChrome({ children }: { children: React.ReactNode }) {
  const { status, admin, logout, loggingOut } = useAdminAuth();

  if (status === "loading") {
    return <Loader label="Confirmando tu acceso..." />;
  }

  if (status === "unauthenticated") {
    return (
      <div className="bg-background flex flex-1 flex-col items-center justify-center gap-6 px-6">
        <AdminLoginForm />
      </div>
    );
  }

  return (
    <DashboardShell
      brand="Brokaza Admin"
      navItems={NAV_ITEMS}
      email={admin?.email}
      onLogout={() => void logout()}
      loggingOut={loggingOut}
    >
      {children}
    </DashboardShell>
  );
}
