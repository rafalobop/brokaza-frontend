import { useEffect, useRef, useState, type ReactNode } from "react";
import { Menu } from "lucide-react";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { ThemeToggle } from "@/components/ThemeToggle";
import { NoTranslate } from "@/components/ui/NoTranslate";

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
 * funcionalidad todavía), foco en el área de perfil (avatar con inicial + email). En mobile suma
 * el botón hamburguesa que abre el drawer de `Sidebar` (oculto en desktop, donde el sidebar ya es
 * una columna fija siempre visible).
 *
 * KAN-299: el icono de avatar es un botón que despliega un menú con "Cerrar sesión" (antes era un
 * link siempre visible, oculto en mobile bajo el breakpoint `sm` junto con el email — sin
 * reemplazo, dejaba a los usuarios de mobile sin forma de cerrar sesión). El avatar usa
 * `NoTranslate` porque el traductor automático del navegador puede reescribir la inicial de una
 * sola letra y romper el layout del círculo (mismo mecanismo que KAN-298, ver `NoTranslate.tsx`).
 */
export function Topbar({ email, onLogout, loggingOut, extraActions, onMenuClick }: TopbarProps) {
  const initial = email?.trim().charAt(0).toUpperCase() || "?";
  const [confirmingLogout, setConfirmingLogout] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handlePointerDown(event: PointerEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

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
        <ThemeToggle />
        <div ref={menuRef} className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Abrir menú de usuario"
            onClick={() => setMenuOpen((prev) => !prev)}
            className="rounded-radius-sm flex items-center gap-3"
          >
            <NoTranslate
              as="span"
              className="bg-accent flex h-9 w-9 items-center justify-center rounded-full text-sm font-semibold text-white"
            >
              {initial}
            </NoTranslate>
            <span className="text-foreground hidden max-w-40 truncate text-sm font-medium sm:inline">
              {email}
            </span>
          </button>

          {menuOpen ? (
            <div
              role="menu"
              className="rounded-radius-sm border-card-border bg-paper text-forest dark:text-foreground absolute top-full right-0 z-20 mt-2 min-w-40 border py-1 shadow-(--shadow) dark:bg-[#1F292B]"
            >
              <span className="block truncate px-4 py-1 text-xs opacity-70 sm:hidden">{email}</span>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  setConfirmingLogout(true);
                }}
                disabled={loggingOut}
                className="hover:bg-accent-glow block w-full px-4 py-2 text-left text-sm disabled:opacity-60"
              >
                {loggingOut ? "Cerrando sesión..." : "Cerrar sesión"}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {confirmingLogout ? (
        <ConfirmModal
          title="Cerrar sesión"
          message="¿Seguro que querés cerrar sesión?"
          confirmLabel="Cerrar sesión"
          confirming={loggingOut}
          onConfirm={() => {
            setConfirmingLogout(false);
            onLogout();
          }}
          onCancel={() => setConfirmingLogout(false)}
        />
      ) : null}
    </header>
  );
}
