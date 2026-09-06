/**
 * @jest-environment node
 *
 * Integration test para KAN-150: levanta un `next dev` real (server HTTP de
 * verdad, no llamadas internas a next.config.rewrites) contra un backend
 * Express mockeado, y verifica que el proxy same-origin funciona de punta a
 * punta: /api, /internal y /health llegan al backend (incluida la cookie que
 * setea), y una ruta desconocida sigue devolviendo el 404 propio de Next.js
 * (no el 404 del backend) — o sea, el rewrite no está "atrapando todo".
 */
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import fs from "node:fs";
import http, { type Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";

// Mata todo el árbol de procesos (npx -> node -> turbopack workers). En
// Windows, `ChildProcess#kill()` solo termina el proceso inmediato (el shell
// de `shell: true`) y deja huérfanos los procesos hijos reales del server de
// Next.js, que se quedan reteniendo el puerto y el lockfile de `next dev`
// para siempre.
function killProcessTree(pid: number): void {
  if (process.platform === "win32") {
    try {
      execFileSync("taskkill", ["/PID", String(pid), "/T", "/F"]);
    } catch {
      // ya estaba muerto o no se pudo matar — no es fatal para el test
    }
  } else {
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      // ya estaba muerto
    }
  }
}

const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const TSCONFIG_PATH = path.join(PROJECT_ROOT, "tsconfig.json");

interface SimpleResponse {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}

// Jest's `node` test environment doesn't reliably expose the global `fetch`
// (undici) the way a plain `node script.js` run does, so this integration
// test talks HTTP directly via `node:http` instead of relying on it.
function httpGet(url: string): Promise<SimpleResponse> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        resolve({
          status: res.statusCode ?? 0,
          headers: res.headers,
          body: Buffer.concat(chunks).toString("utf8"),
        });
      });
    });
    req.on("error", reject);
  });
}

function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = http.createServer();
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      server.close((err) => (err ? reject(err) : resolve(port)));
    });
    server.on("error", reject);
  });
}

function startMockBackend(): Promise<{ server: Server; port: number }> {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (req.url === "/health") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, from: "express-mock" }));
        return;
      }
      if (req.url === "/api/ping") {
        res.writeHead(200, {
          "Content-Type": "application/json",
          "Set-Cookie": "brokaza_session=mock-token; Path=/; HttpOnly",
        });
        res.end(JSON.stringify({ pong: true, from: "express-mock" }));
        return;
      }
      if (req.url === "/internal/echo") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ internal: true, from: "express-mock" }));
        return;
      }
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("backend not found");
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, port });
    });
    server.on("error", reject);
  });
}

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError: unknown;
  while (Date.now() < deadline) {
    try {
      const res = await httpGet(url);
      if (res.status > 0) return;
    } catch (err) {
      lastError = err;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Next.js dev server no levantó a tiempo en ${url}: ${String(lastError)}`);
}

describe("proxy same-origin de Next.js hacia Express (KAN-150)", () => {
  // Turbopack compila cada ruta on-demand la primera vez que se pide (dev
  // mode) — en un entorno con recursos compartidos esa primera compilación
  // puede tardar bastante, así que el timeout global tiene que cubrir boot +
  // primeros hits a cada ruta involucrada.
  jest.setTimeout(180_000);

  let backend: { server: Server; port: number };
  let nextPort: number;
  let nextProcess: ChildProcess;
  // `next dev` reescribe tsconfig.json in-place la primera vez que corre en
  // una máquina (agrega entradas de `include` para sus tipos generados) —
  // efecto colateral del framework, no de este test. Se restaura en
  // afterAll para que correr el test no ensucie el árbol de trabajo.
  const originalTsconfig = fs.readFileSync(TSCONFIG_PATH, "utf8");

  beforeAll(async () => {
    backend = await startMockBackend();
    nextPort = await getFreePort();

    nextProcess = spawn("npx", ["--no-install", "next", "dev", "-p", String(nextPort)], {
      cwd: PROJECT_ROOT,
      env: {
        ...process.env,
        BACKEND_ORIGIN: `http://127.0.0.1:${backend.port}`,
      },
      stdio: "pipe",
      shell: true,
      detached: process.platform !== "win32",
    });

    nextProcess.stdout?.on("data", (d) => process.stdout.write(`[next] ${d}`));
    nextProcess.stderr?.on("data", (d) => process.stderr.write(`[next] ${d}`));

    await waitForServer(`http://127.0.0.1:${nextPort}/`, 90_000);

    // Precalienta las rutas antes de que corran los `it`, para que el costo
    // de la primera compilación de Turbopack no cuente contra el timeout de
    // cada test individual.
    await httpGet(`http://127.0.0.1:${nextPort}/health`);
    await httpGet(`http://127.0.0.1:${nextPort}/api/ping`);
    await httpGet(`http://127.0.0.1:${nextPort}/internal/echo`);
    await httpGet(`http://127.0.0.1:${nextPort}/esta-ruta-no-existe`);
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => backend.server.close(() => resolve()));
    if (nextProcess?.pid) {
      killProcessTree(nextProcess.pid);
    }
    fs.writeFileSync(TSCONFIG_PATH, originalTsconfig);
  });

  it("proxea /health hacia Express manteniendo same-origin", async () => {
    const res = await httpGet(`http://127.0.0.1:${nextPort}/health`);
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true, from: "express-mock" });
  });

  it("proxea /api/* preservando las cookies que setea Express (sin CORS de por medio)", async () => {
    const res = await httpGet(`http://127.0.0.1:${nextPort}/api/ping`);
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({
      pong: true,
      from: "express-mock",
    });
    const setCookie = res.headers["set-cookie"]?.join(";") ?? "";
    expect(setCookie).toContain("brokaza_session=mock-token");
  });

  it("proxea /internal/* hacia Express", async () => {
    const res = await httpGet(`http://127.0.0.1:${nextPort}/internal/echo`);
    expect(res.status).toBe(200);
    expect(JSON.parse(res.body)).toEqual({
      internal: true,
      from: "express-mock",
    });
  });

  it("una ruta desconocida devuelve el 404 propio de Next.js, no el del backend", async () => {
    const res = await httpGet(`http://127.0.0.1:${nextPort}/esta-ruta-no-existe`);
    expect(res.status).toBe(404);
    expect(res.body).not.toContain("backend not found");
  });
});
