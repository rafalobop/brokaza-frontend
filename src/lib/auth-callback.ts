/**
 * Parsing del callback de magic-link (KAN-166), portado de
 * `handleMagicLinkCallback`/`handleAuthErrorCallback` del dashboard legacy
 * (`src/dashboard/app.js` líneas 403-457). El link de Supabase siempre redirige a la raíz de
 * `APP_URL` con el token/error en el hash — nunca a un path aparte — así que se invoca desde el
 * provider que se monta en la raíz del árbol (`AuthProvider`/`AdminAuthProvider`) en vez de una
 * ruta dedicada. Ver `docs/magic-link-flow-design.md`.
 *
 * Extraída de `auth-context.tsx` (KAN-239, self-check de `react-doctor`,
 * `only-export-components`): un archivo `"use client"` de componente no debe exportar funciones
 * sueltas además del/los componente(s) — rompe el fast refresh de React. Vive acá para que tanto
 * `auth-context.tsx` (tenant) como `admin-auth-context.tsx` (admin) la reusen sin duplicarla — el
 * mecanismo de Supabase es idéntico para ambos, solo cambia a qué endpoint se manda el token
 * (`exchangeToken`, inyectado por el llamador).
 */

export const EXPIRED_LINK_MESSAGE =
  "Tu link de acceso expiró o ya fue usado. Ingresá tu email para solicitar uno nuevo.";
export const INVALID_LINK_MESSAGE =
  "El link de acceso no es válido. Ingresá tu email para solicitar uno nuevo.";

export async function consumeAuthCallbackHash(
  exchangeToken: (accessToken: string) => Promise<unknown>,
  logTag = "[AUTH]",
): Promise<{ exchanged: boolean; error: string | null }> {
  if (typeof window === "undefined") return { exchanged: false, error: null };

  const hash = window.location.hash;
  if (!hash) return { exchanged: false, error: null };

  const params = new URLSearchParams(hash.replace(/^#/, ""));

  const errorCode = params.get("error_code");
  if (hash.includes("error=")) {
    window.history.replaceState(null, "", window.location.pathname);
    console.warn(
      `${logTag} El link de acceso llegó con un error:`,
      errorCode,
      params.get("error_description"),
    );
    return {
      exchanged: false,
      error: errorCode === "otp_expired" ? EXPIRED_LINK_MESSAGE : INVALID_LINK_MESSAGE,
    };
  }

  const accessToken = params.get("access_token");
  if (!hash.includes("access_token=") || !accessToken) {
    return { exchanged: false, error: null };
  }

  window.history.replaceState(null, "", window.location.pathname);
  console.log(`${logTag} Magic link callback detectado, intercambiando token...`);
  try {
    await exchangeToken(accessToken);
    console.log(`${logTag} Token intercambiado correctamente, sesión iniciada.`);
    return { exchanged: true, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al intercambiar el token.";
    console.error(`${logTag} Fallo al intercambiar token:`, message);
    return { exchanged: false, error: message };
  }
}

/**
 * Callback del magic link de admin (KAN-342). A diferencia de `consumeAuthCallbackHash` de
 * arriba, este NO depende del redirect hosteado de Supabase (`action_link`) — el backend
 * (`matchouse/src/adminRoutes.ts#request-magic-link`) arma su propio link con `?token_hash=...
 * &type=magiclink` (un query param, no un fragment `#...`) y lo manda directo por email. Se
 * canjea llamando a `exchange-token`, que hace `supabase.auth.verifyOtp` server-side — Supabase
 * nunca redirige a ningún lado en este flujo, así que no hace falta que la URL de destino esté en
 * el allow-list de "Redirect URLs" de su dashboard (el problema real que forzó este cambio).
 */
export async function consumeAuthCallbackQuery(
  exchangeToken: (params: { token_hash: string; type: string }) => Promise<unknown>,
  logTag = "[AUTH]",
): Promise<{ exchanged: boolean; error: string | null }> {
  if (typeof window === "undefined") return { exchanged: false, error: null };

  const params = new URLSearchParams(window.location.search);
  const tokenHash = params.get("token_hash");
  const type = params.get("type");
  if (!tokenHash || !type) return { exchanged: false, error: null };

  window.history.replaceState(null, "", window.location.pathname);
  console.log(`${logTag} Magic link callback detectado (token_hash), intercambiando token...`);
  try {
    await exchangeToken({ token_hash: tokenHash, type });
    console.log(`${logTag} Token intercambiado correctamente, sesión iniciada.`);
    return { exchanged: true, error: null };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error al intercambiar el token.";
    console.error(`${logTag} Fallo al intercambiar token:`, message);
    return { exchanged: false, error: message };
  }
}
