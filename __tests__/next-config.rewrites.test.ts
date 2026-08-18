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
