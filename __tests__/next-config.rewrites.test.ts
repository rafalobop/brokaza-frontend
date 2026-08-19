/**
 * @jest-environment node
 */
import nextConfig from "../next.config";

describe("next.config rewrites (KAN-150)", () => {
  const originalBackendOrigin = process.env.BACKEND_ORIGIN;

  afterEach(() => {
    process.env.BACKEND_ORIGIN = originalBackendOrigin;
  });

  it("proxies /api/*, /internal/* and /health to BACKEND_ORIGIN", async () => {
    process.env.BACKEND_ORIGIN = "http://localhost:3000";

    if (typeof nextConfig.rewrites !== "function") {
      throw new Error("next.config.ts debe exportar una función rewrites()");
    }

    const rewrites = await nextConfig.rewrites();
    const list = Array.isArray(rewrites) ? rewrites : (rewrites.afterFiles ?? []);

    expect(list).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "/api/:path*",
          destination: "http://localhost:3000/api/:path*",
        }),
        expect.objectContaining({
          source: "/internal/:path*",
          destination: "http://localhost:3000/internal/:path*",
        }),
        expect.objectContaining({
          source: "/health",
          destination: "http://localhost:3000/health",
        }),
      ]),
    );
  });

  it("proxies /admin/api/* to ADMIN_BACKEND_ORIGIN (KAN-239), independent of /api/*", async () => {
    if (typeof nextConfig.rewrites !== "function") {
      throw new Error("next.config.ts debe exportar una función rewrites()");
    }

    const rewrites = await nextConfig.rewrites();
    const list = Array.isArray(rewrites) ? rewrites : (rewrites.afterFiles ?? []);

    // Sin ADMIN_BACKEND_ORIGIN seteada, cae al mismo default que BACKEND_ORIGIN (ver comentario
    // en next.config.ts) — el módulo ya evaluó sus consts al importarse arriba, así que esto
    // ejercita el default real, no un valor seteado dentro del test (mismo criterio que el test
    // de arriba).
    expect(list).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: "/admin/api/:path*",
          destination: "http://localhost:3000/api/:path*",
        }),
      ]),
    );

    // El rewrite de /admin/api/* debe aparecer ANTES que el de /api/* genérico — Next.js
    // resuelve rewrites en orden y el primer `source` que matchee gana.
    const adminIndex = list.findIndex((rule) => rule.source === "/admin/api/:path*");
    const tenantIndex = list.findIndex((rule) => rule.source === "/api/:path*");
    expect(adminIndex).toBeGreaterThanOrEqual(0);
    expect(tenantIndex).toBeGreaterThanOrEqual(0);
    expect(adminIndex).toBeLessThan(tenantIndex);
  });

  it("does not rewrite arbitrary app routes (so Next.js keeps serving its own 404)", async () => {
    if (typeof nextConfig.rewrites !== "function") {
      throw new Error("next.config.ts debe exportar una función rewrites()");
    }

    const rewrites = await nextConfig.rewrites();
    const list = Array.isArray(rewrites) ? rewrites : (rewrites.afterFiles ?? []);

    const matchesEverything = list.some((rule) => rule.source === "/:path*");
    expect(matchesEverything).toBe(false);
  });
});
