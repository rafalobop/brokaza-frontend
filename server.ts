/**
 * Servidor custom de Next.js — necesario solo para proxear el upgrade de WebSocket de
 * `/ws` hacia Express. `rewrites()` (next.config.ts, KAN-150) resuelve el proxy same-origin
 * para HTTP (`/api`, `/internal`, `/health`), pero Next.js no proxea upgrades de WebSocket a
 * través de `rewrites()` — limitación conocida del framework, no un bug de config.
 *
 * Por qué hace falta que sea same-origin (y no conectar el WS directo a BACKEND_ORIGIN desde
 * el browser): el backend autentica el handshake leyendo la cookie `brokaza_session` del
 * request crudo (`matchouse/src/services/realtimeHub.ts`), y esa cookie el browser solo la
 * manda a un origen que considere el mismo que le sirvió la página — hoy eso es el origen de
 * Next.js, no el de Express.
 */
import { createServer, request as httpRequest, type IncomingMessage } from "http";
import type { Socket } from "net";
import next from "next";

const dev = process.env.NODE_ENV !== "production";
const port = Number(process.env.PORT) || 3001;
const backendOrigin = process.env.BACKEND_ORIGIN ?? "http://localhost:3000";

const app = next({ dev, turbopack: dev });
const handle = app.getRequestHandler();

function proxyWebSocketUpgrade(req: IncomingMessage, socket: Socket, head: Buffer): void {
  const target = new URL(backendOrigin);

  const proxyReq = httpRequest({
    hostname: target.hostname,
    port: target.port || (target.protocol === "https:" ? 443 : 80),
    path: req.url,
    method: req.method,
    headers: { ...req.headers, host: target.host },
  });

  proxyReq.on("upgrade", (proxyRes, proxySocket, proxyHead) => {
    const statusHeaders = Object.entries(proxyRes.headers)
      .map(([key, value]) => `${key}: ${value}`)
      .join("\r\n");
    socket.write(`HTTP/1.1 101 Switching Protocols\r\n${statusHeaders}\r\n\r\n`);
    if (proxyHead.length) socket.write(proxyHead);
    if (head.length) proxySocket.write(head);
    proxySocket.pipe(socket);
    socket.pipe(proxySocket);
  });

  proxyReq.on("error", (err) => {
    console.error("[WS PROXY] Error al conectar con el backend:", err.message);
    socket.destroy();
  });
  socket.on("error", () => proxyReq.destroy());

  proxyReq.end();
}

app.prepare().then(() => {
  const server = createServer((req, res) => handle(req, res));

  server.on("upgrade", (req, socket, head) => {
    if (req.url === "/ws") {
      proxyWebSocketUpgrade(req, socket as Socket, head);
      return;
    }
    // HMR y cualquier otro upgrade propio de Next.js en dev.
    void app.getUpgradeHandler()(req, socket, head);
  });

  server.listen(port, () => {
    console.log(`> brokaza-frontend listo en http://localhost:${port}`);
  });
});
