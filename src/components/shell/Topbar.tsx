import type { ReactNode } from "react";
import { Menu } from "lucide-react";

interface TopbarProps {
  email: string | undefined;
  onLogout: () => void;
  loggingOut: boolean;
  /** Slot para acciones extra a la izquierda del perfil (ej. `PushNotificationButton` en tenant). */
  extraActions?: ReactNode;
  /** Abre el drawer mobile de `Sidebar` — el botón solo se muestra bajo el breakpoint `md`. */
  onMenuClick: () => void;
}

/**
 * Barra superior — "topbar" del brief, adaptado: sin buscador global (no existe esa
 * funcionalidad todavía), foco en el área de perfil (avatar con inicial + email) y logout. En
 * mobile suma el botón hamburguesa que abre el drawer de `Sidebar` (oculto en desktop, donde el
 * sidebar ya es una columna fija siempre visible).
 */
export function Topbar({ email, onLogout, loggingOut, extraActions, onMenuClick }: TopbarProps) {
  const initial = email?.trim().charAt(0).toUpperCase() || "?";

  return (
    <header className="border-card-border flex items-center justify-between gap-4 border-b px-4 py-4 sm:px-6 md:justify-end">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Abrir menú de navegación"
        className="rounded-radius-sm text-text-secondary hover:bg-card p-2 md:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      <div className="flex items-center gap-4">
        {extraActions}
        <div className="flex items-center gap-3">
          <span className="bg-accent flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-white">
            {initial}
          </span>
          <div className="hidden flex-col leading-tight sm:flex">
            <span className="text-foreground max-w-40 truncate text-sm font-medium">{email}</span>
            <button
              type="button"
              onClick={onLogout}
              disabled={loggingOut}
              className="text-text-secondary text-left text-xs underline underline-offset-2 disabled:opacity-60"
            >
              {loggingOut ? "Cerrando sesión..." : "Cerrar sesión"}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
