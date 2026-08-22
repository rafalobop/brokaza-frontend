"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";

export interface SidebarNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

interface SidebarProps {
  brand: string;
  navItems: SidebarNavItem[];
  /** Controla el drawer mobile (`Topbar` expone el botón hamburguesa que lo abre). */
  mobileOpen: boolean;
  onMobileClose: () => void;
}

function SidebarContent({
  brand,
  navItems,
  onNavigate,
}: SidebarProps & { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <div className="flex h-full w-full flex-col gap-8 px-4 py-6">
      <Link href="/" onClick={onNavigate} className="flex items-center gap-2 px-2">
        <Image
          src="/logo_brokaza.png"
          alt=""
          width={32}
          height={32}
          className="rounded-radius-md object-cover"
        />
        <span className="font-heading text-foreground text-lg font-bold">{brand}</span>
      </Link>

      <nav className="flex flex-col gap-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`rounded-radius-sm flex w-full items-center gap-3 border-l-2 px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                isActive
                  ? "border-accent bg-accent-glow text-accent"
                  : "text-text-secondary hover:bg-card hover:text-foreground border-transparent"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />
    </div>
  );
}

/**
 * Columna izquierda del dashboard — "sidebar" del brief: brand area, navegación primaria con
 * indicador de item activo (borde de acento + fondo tenue) y una card de utilidad anclada abajo.
 *
 * Desktop: columna fija (`hidden md:flex`). Mobile: drawer que desliza desde la izquierda sobre
 * un backdrop, controlado por `mobileOpen`/`onMobileClose` (el botón hamburguesa vive en
 * `Topbar`) — se cierra solo al navegar (mismo `pathname` que marca el item activo) o con el
 * backdrop/botón X.
 */
export function Sidebar(props: SidebarProps) {
  const { mobileOpen, onMobileClose } = props;
  const pathname = usePathname();

  useEffect(() => {
    onMobileClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo debe reaccionar a cambios de ruta.
  }, [pathname]);

  return (
    <>
      <aside className="border-card-border hidden w-60 shrink-0 border-r md:flex md:flex-col">
        <SidebarContent {...props} />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={onMobileClose}
            className="bg-forest/60 absolute inset-0 backdrop-blur-sm"
          />
          <div className="border-card-border bg-background relative flex w-72 max-w-[80vw] flex-col border-r shadow-(--shadow)">
            <button
              type="button"
              aria-label="Cerrar menú"
              onClick={onMobileClose}
              className="text-text-secondary hover:bg-card absolute top-4 right-3 rounded-full p-1.5"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            <SidebarContent {...props} onNavigate={onMobileClose} />
          </div>
        </div>
      ) : null}
    </>
  );
}
