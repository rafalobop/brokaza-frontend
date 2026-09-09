import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

// Fase 0 (KAN-150): Next.js hace de proxy same-origin hacia el Express legacy.
// El navegador solo habla con el origen de Next.js -> nunca hay CORS ni cookies
// cross-origin, porque el rewrite resuelve el proxy server-side (ver §3 de
// MIGRATION_PLAN.md, "camino de menor riesgo").
const backendOrigin = process.env.BACKEND_ORIGIN ?? "http://localhost:3000";

// KAN-239: el panel admin (matchouse/src/adminRoutes.ts#mountAdminRouter) es una rama del
// backend activada solo cuando `req.hostname === config.adminHost` — no hay forma de que un
// único BACKEND_ORIGIN sirva a la vez las rutas de tenant y las de admin (mismos paths
// `/api/auth/*`, distinta cookie/allowlist). Se resuelve con un prefijo de path propio
// (`/admin/api/*`) hacia un origin separado — en producción, `ADMIN_BACKEND_ORIGIN` apunta a la
// URL pública del host admin, así el Host que le llega a Express coincide con `config.adminHost`
// sin ningún truco adicional. Default = backendOrigin a propósito: sin configurar nada extra,
// `pnpm dev` local sigue funcionando igual que antes (el backend sin ADMIN_HOST simplemente
// nunca monta esas rutas, así que devuelven 404 — mismo comportamiento que hoy). Ver
// docs/admin-auth-design.md (Opción C) para el resto del análisis.
const adminBackendOrigin = process.env.ADMIN_BACKEND_ORIGIN ?? backendOrigin;

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/admin/api/:path*", destination: `${adminBackendOrigin}/api/:path*` },
      { source: "/api/:path*", destination: `${backendOrigin}/api/:path*` },
      {
        source: "/internal/:path*",
        destination: `${backendOrigin}/internal/:path*`,
      },
      { source: "/health", destination: `${backendOrigin}/health` },
    ];
  },
};

// KAN-322: sube source maps a Sentry en el build para que los stack traces reportados
// muestren código fuente en vez de bundle minificado. Sin `SENTRY_AUTH_TOKEN` (no seteado en
// dev/CI sin credenciales) el plugin se desactiva solo y el build sigue igual que antes.
export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
});
