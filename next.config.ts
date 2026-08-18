import type { NextConfig } from "next";

// Fase 0 (KAN-150): Next.js hace de proxy same-origin hacia el Express legacy.
// El navegador solo habla con el origen de Next.js -> nunca hay CORS ni cookies
// cross-origin, porque el rewrite resuelve el proxy server-side (ver §3 de
// MIGRATION_PLAN.md, "camino de menor riesgo").
const backendOrigin = process.env.BACKEND_ORIGIN ?? "http://localhost:3000";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${backendOrigin}/api/:path*` },
      {
        source: "/internal/:path*",
        destination: `${backendOrigin}/internal/:path*`,
      },
      { source: "/health", destination: `${backendOrigin}/health` },
    ];
  },
};

export default nextConfig;
