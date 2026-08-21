/**
 * Detección de "iOS sin instalar como PWA" (KAN-257) — port 1:1 de
 * `matchouse/src/dashboard/ios-onboarding.js` (KAN-47) a TypeScript.
 *
 * iOS Safari solo soporta la Web Push API para PWAs agregadas a la pantalla de inicio (no en una
 * pestaña normal) — sin este chequeo, un usuario de iOS que toca "Activar notificaciones" no ve
 * ningún error, simplemente no pasa nada (`isPushSupported()` corta en silencio si `PushManager`
 * no está disponible, ver `push-notifications.ts`). El banner que consume esto
 * (`IosInstallBanner.tsx`) se muestra ANTES de que el usuario llegue a pedir el permiso, para
 * explicar el paso previo necesario. Ver `docs/push-notifications-ios-workflow.md` para el
 * detalle completo del flujo.
 */

type NavigatorLike = Pick<Navigator, "userAgent" | "platform" | "maxTouchPoints"> & {
  standalone?: boolean;
};
type WindowLike = Pick<Window, "matchMedia">;

function currentNavigator(nav?: NavigatorLike): NavigatorLike {
  if (nav) return nav;
  if (typeof navigator === "undefined") return { userAgent: "", platform: "", maxTouchPoints: 0 };
  return navigator as NavigatorLike;
}

function currentWindow(win?: WindowLike): WindowLike | null {
  if (win) return win;
  return typeof window === "undefined" ? null : window;
}

export function isIosDevice(nav?: NavigatorLike): boolean {
  const n = currentNavigator(nav);
  const ua = n.userAgent || "";
  const isClassicIos = /iPad|iPhone|iPod/.test(ua);
  // iPadOS 13+ reporta un userAgent de Safari de escritorio (se hace pasar por Mac) — se
  // distingue de un Mac real porque soporta touch (maxTouchPoints > 1).
  const isIpadOsDesktopUa = n.platform === "MacIntel" && (n.maxTouchPoints || 0) > 1;
  return isClassicIos || isIpadOsDesktopUa;
}

export function isRunningAsInstalledPwa(nav?: NavigatorLike, win?: WindowLike): boolean {
  const n = currentNavigator(nav);
  const w = currentWindow(win);
  const standaloneFlag = n.standalone === true;
  const matchesDisplayMode =
    !!w && typeof w.matchMedia === "function" && w.matchMedia("(display-mode: standalone)").matches;
  return standaloneFlag || matchesDisplayMode;
}

export function shouldShowIosInstallOnboarding(nav?: NavigatorLike, win?: WindowLike): boolean {
  return isIosDevice(nav) && !isRunningAsInstalledPwa(nav, win);
}
