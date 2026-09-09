/**
 * Tema claro/oscuro (KAN-256), port de `matchouse/src/dashboard/app.js`
 * (`THEME_STORAGE_KEY`/`applyTheme`/`initTheme`, líneas 57-84) + `public/scripts/themeSetter.js`
 * (el script sin-FOUC que ya corría antes de `app.js`).
 *
 * A diferencia del legacy (solo `localStorage`), acá se suma un fallback a cookie cuando
 * `localStorage` no está disponible (ej. modo privado estricto de Safari, donde `setItem` tira) —
 * pedido explícito de este ticket, no existía en el legacy.
 */

export const THEME_STORAGE_KEY = "matchouse-theme";

export type Theme = "light" | "dark";

function readCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function writeCookie(name: string, value: string): void {
  if (typeof document === "undefined") return;
  // 1 año — misma duración larga que amerita una preferencia de UI, no una sesión.
  // Secure solo si la conexión es HTTPS (KAN-329) — en HTTP, el atributo Secure hace que el
  // navegador descarte la cookie por completo, así que agregarlo incondicionalmente rompería
  // el fallback en entornos legacy/dev servidos por HTTP.
  const secure =
    typeof location !== "undefined" && location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${365 * 24 * 60 * 60}; samesite=lax${secure}`;
}

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark";
}

/**
 * Lee la preferencia guardada — `localStorage` primero, cookie como fallback si `localStorage`
 * no está disponible o no tiene nada guardado todavía. Default `"light"` si ninguna de las dos
 * tiene un valor válido (mismo default que el legacy: `stored === 'dark' ? 'dark' : 'light'`).
 */
export function getStoredTheme(): Theme {
  if (typeof window === "undefined") return "light";

  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isTheme(stored)) return stored;
  } catch {
    // localStorage bloqueado — sigue al fallback de cookie.
  }

  const cookie = readCookie(THEME_STORAGE_KEY);
  return isTheme(cookie) ? cookie : "light";
}

/** Persiste la preferencia — intenta `localStorage`, cae a cookie si tira. */
export function storeTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    return;
  } catch {
    // localStorage no disponible — fallback a cookie.
  }
  writeCookie(THEME_STORAGE_KEY, theme);
}

/** Aplica el tema al DOM — mismo mecanismo que el legacy (`data-theme` en `<html>`). */
export function applyTheme(theme: Theme): void {
  if (typeof document === "undefined") return;
  document.documentElement.setAttribute("data-theme", theme);
}

/** Lee el tema actualmente aplicado al DOM (fuente de verdad tras el script sin-FOUC). */
export function getAppliedTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

/**
 * Fuente del script sin-FOUC que va inline en `<head>` (ver `layout.tsx`), antes de que el
 * navegador pinte el `<body>`. Tiene que ser un string autocontenido (no puede importar
 * `getStoredTheme` — corre antes de que cualquier bundle de React se descargue), así que
 * replica su misma lógica lectura-localStorage-primero-cookie-como-fallback a mano. Generado
 * como función (no una constante) para interpolar `THEME_STORAGE_KEY` una sola vez y no
 * duplicar el nombre de la key en dos lugares del código.
 */
export function buildThemeInitScript(): string {
  const key = JSON.stringify(THEME_STORAGE_KEY);
  return `(function(){try{var t=window.localStorage.getItem(${key});if(t!=="light"&&t!=="dark"){var m=document.cookie.match(new RegExp("(?:^|; )"+${key}+"=([^;]*)"));t=m?decodeURIComponent(m[1]):null;}document.documentElement.setAttribute("data-theme",t==="dark"?"dark":"light");}catch(e){document.documentElement.setAttribute("data-theme","light");}})();`;
}
