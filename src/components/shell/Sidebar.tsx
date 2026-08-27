"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { X } from "lucide-react";

export interface SidebarNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** KAN-298: marca `label` como término crítico (ej. "Matches") que no debe traducirse. */
  notranslate?: boolean;
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
  mobile = false,
}: SidebarProps & { onNavigate?: () => void; mobile?: boolean }) {
  const pathname = usePathname();

  return (
    // `overflow-y-auto`: los contenedores que envuelven esto (`aside` en desktop, el drawer en
    // mobile) tienen `overflow-hidden` para recortar las esquinas redondeadas del gradiente de
    // marca — sin esta línea, si `navItems` alguna vez crece más de lo que entra en la altura
    // disponible (pantalla chica / mobile en horizontal), ese `overflow-hidden` del padre
    // bloquea el desplazamiento del propio sidebar en vez de solo recortar el fondo (KAN-301).
    //
    // `mobile`: el drawer no es solo el sidebar de desktop angostado — necesita verse como un
    // panel de navegación mobile real (botones grandes, más aire), no una versión mini adaptada.
    // Mismo componente para no duplicar la lista de nav, pero escalado vía este flag.
    <div
      className={`flex h-full w-full flex-col overflow-y-auto ${mobile ? "gap-10 p-6" : "gap-8 p-6"}`}
    >
      <Link
        href="/"
        onClick={onNavigate}
        className={`flex items-center px-2 ${mobile ? "gap-3" : "gap-3"}`}
      >
        <Image
          src="/logo_brokaza.png"
          alt=""
          width={mobile ? 44 : 40}
          height={mobile ? 44 : 40}
          className="rounded-radius-md object-cover"
        />
        {/* KAN-298: "Brokaza" es el nombre de marca — término crítico, ver NoTranslate.tsx. */}
        <span
          translate="no"
          className={`notranslate font-heading font-bold text-white ${mobile ? "text-2xl" : "text-xl"}`}
        >
          {brand}
        </span>
      </Link>

      <nav className={`flex flex-col ${mobile ? "gap-3" : "gap-2.5"}`}>
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={`flex w-full items-center rounded-2xl transition-colors duration-150 ${
                mobile ? "gap-4 px-4 py-4 text-base" : "gap-3.5 px-4 py-3.5 text-[15px]"
              } ${
                isActive
                  ? "text-forest bg-white font-semibold shadow-sm"
                  : "text-sidebar-muted hover:text-sidebar-muted-hover font-normal hover:bg-white/10"
              }`}
            >
              <Icon
                className={mobile ? "h-6 w-6 shrink-0" : "h-5 w-5 shrink-0"}
                aria-hidden="true"
              />
              {item.notranslate ? (
                <span translate="no" className="notranslate">
                  {item.label}
                </span>
              ) : (
                item.label
              )}
            </Link>
          );
        })}
      </nav>

      <div className="flex-1" />
    </div>
  );
}

/**
 * Columna izquierda del dashboard — "sidebar" del brief: brand area y navegación primaria sobre
 * una tarjeta flotante con gradiente de marca (KAN-300), con el item activo resuelto como pill
 * blanco (`bg-white text-forest`) en vez del borde de acento anterior.
 *
 * Desktop: columna fija (`hidden md:flex`). Mobile: drawer que desliza desde la izquierda sobre
 * un backdrop, controlado por `mobileOpen`/`onMobileClose` (el botón hamburguesa vive en
 * `Topbar`) — se cierra solo al navegar (mismo `pathname` que marca el item activo) o con el
 * backdrop/botón X.
 */
/** Duración (ms) de la transición de entrada/salida del drawer — debe matchear `duration-300`. */
const DRAWER_TRANSITION_MS = 300;

export function Sidebar(props: SidebarProps) {
  const { mobileOpen, onMobileClose } = props;
  const pathname = usePathname();
  // KAN-300: para animar también el cierre hace falta mantener el drawer montado durante la
  // transición de salida — desmontarlo en el mismo render que `mobileOpen` pasa a `false` no deja
  // que el navegador pinte el frame intermedio. `rendered` controla el mount/unmount (con delay al
  // cerrar); `entered` controla las clases de transform/opacity y se activa un frame después del
  // mount para que el navegador sí pinte el estado "cerrado" antes de animar hacia "abierto".
  const [rendered, setRendered] = useState(mobileOpen);
  const [entered, setEntered] = useState(mobileOpen);

  useEffect(() => {
    onMobileClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo debe reaccionar a cambios de ruta.
  }, [pathname]);

  useEffect(() => {
    // react-hooks/set-state-in-effect: los `setState` van adentro de un callback de rAF/timeout
    // (no sincrónicos en el cuerpo del efecto) para que React no los trate como un re-render en
    // cascada dentro del mismo commit — es justamente lo que hace falta acá: el frame "cerrado"
    // tiene que llegar a pintarse antes de programar el frame "abierto" que dispara la transición.
    if (mobileOpen) {
      const raf = requestAnimationFrame(() => {
        setRendered(true);
        requestAnimationFrame(() => setEntered(true));
      });
      return () => cancelAnimationFrame(raf);
    }
    const raf = requestAnimationFrame(() => setEntered(false));
    const timeout = setTimeout(() => setRendered(false), DRAWER_TRANSITION_MS);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(timeout);
    };
  }, [mobileOpen]);

  return (
    <>
      {/* KAN-300: "container" del spec de diseño — tarjeta flotante con gradiente de marca
          (forest -> teal), en vez de una columna plana con borde. Mismo tratamiento para
          desktop y el drawer mobile de abajo, ya que comparten `SidebarContent`. */}
      <aside className="from-forest to-teal rounded-radius-lg hidden w-64 shrink-0 overflow-hidden bg-gradient-to-b shadow-(--shadow) md:m-3 md:flex md:flex-col">
        <SidebarContent {...props} />
      </aside>

      {rendered ? (
        <div className="fixed inset-0 z-50 flex md:hidden" aria-hidden={!entered}>
          <button
            type="button"
            aria-label="Cerrar menú"
            onClick={onMobileClose}
            className={`bg-forest/60 absolute inset-0 backdrop-blur-sm transition-opacity duration-300 ${
              entered ? "opacity-100" : "opacity-0"
            }`}
          />
          <div
            className={`from-forest to-teal relative flex w-80 max-w-[85vw] flex-col overflow-hidden rounded-r-[28px] bg-gradient-to-b shadow-(--shadow) transition-transform duration-300 ease-out ${
              entered ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <button
              type="button"
              aria-label="Cerrar menú"
              onClick={onMobileClose}
              className="text-sidebar-muted hover:text-sidebar-muted-hover absolute top-5 right-4 rounded-full p-2.5 hover:bg-white/10"
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            <SidebarContent {...props} onNavigate={onMobileClose} mobile />
          </div>
        </div>
      ) : null}
    </>
  );
}
