/**
 * Instrumentación de arranque del server (KAN-322). Convención de Next.js (ver
 * `node_modules/next/dist/docs/01-app/02-guides/instrumentation.md`): `register()` corre una vez
 * por instancia de server, antes de aceptar requests. Carga el init de Sentry del runtime que
 * corresponda — Node.js para el server real, Edge por si el proyecto agrega middleware/rutas edge.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    await import("../sentry.edge.config");
  }
}

export async function onRequestError(
  ...args: Parameters<typeof import("@sentry/nextjs")["captureRequestError"]>
) {
  const { captureRequestError } = await import("@sentry/nextjs");
  captureRequestError(...args);
}
