import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { useRealtimeMatches, type UseRealtimeMatchesOptions } from "@/lib/use-realtime-matches";
import { RealtimeSocketProvider } from "@/lib/realtime-socket-context";

/**
 * Mock mínimo de WebSocket: alcanza para ejercitar open/message/close sin
 * abrir una conexión real. Cada instancia creada queda accesible vía
 * `mockSockets` para que los tests disparen eventos manualmente.
 */
class MockWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;
  listeners: Record<string, Array<(event: unknown) => void>> = {};

  constructor(url: string) {
    this.url = url;
    mockSockets.push(this);
  }

  addEventListener(type: string, listener: (event: unknown) => void) {
    (this.listeners[type] ??= []).push(listener);
  }

  removeEventListener() {}

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.emit("close", {});
  }

  emit(type: string, event: unknown) {
    (this.listeners[type] ?? []).forEach((listener) => listener(event));
  }
}

let mockSockets: MockWebSocket[] = [];

// El socket compartido ahora vive en `RealtimeSocketProvider` (KAN-343: multiplexado por `type`
// entre `useRealtimeMatches` y `useUpload`, ver `realtime-socket-context.tsx`) — estos tests
// montan el hook detrás de ese provider, mismo criterio que usa `MatchesProvider` en la app real.
function renderUseRealtimeMatches(
  options: UseRealtimeMatchesOptions,
  socketEnabled = options.enabled,
) {
  function wrapper({ children }: { children: ReactNode }) {
    return <RealtimeSocketProvider enabled={socketEnabled}>{children}</RealtimeSocketProvider>;
  }
  return renderHook(() => useRealtimeMatches(options), { wrapper });
}

describe("useRealtimeMatches (KAN-187)", () => {
  const originalWebSocket = global.WebSocket;
  const originalFetch = global.fetch;

  beforeEach(() => {
    mockSockets = [];
    // @ts-expect-error -- mock deliberado del WebSocket global
    global.WebSocket = MockWebSocket;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "null",
    });
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    global.WebSocket = originalWebSocket;
    global.fetch = originalFetch;
  });

  it("abre el socket al montar cuando enabled=true", () => {
    renderUseRealtimeMatches({ enabled: true, onRefetch: jest.fn() });

    expect(mockSockets).toHaveLength(1);
    expect(mockSockets[0].url).toBe("ws://localhost/ws");
  });

  it("no abre el socket cuando enabled=false", () => {
    renderUseRealtimeMatches({ enabled: false, onRefetch: jest.fn() });

    expect(mockSockets).toHaveLength(0);
  });

  it("llama a onRefetch cuando llega un mensaje match_count_changed", () => {
    const onRefetch = jest.fn().mockResolvedValue(undefined);
    renderUseRealtimeMatches({ enabled: true, onRefetch });

    const socket = mockSockets[0];
    socket.readyState = MockWebSocket.OPEN;
    socket.emit("open", {});
    socket.emit("message", { data: JSON.stringify({ type: "match_count_changed" }) });

    expect(onRefetch).toHaveBeenCalledTimes(1);
  });

  it("ignora mensajes que no son match_count_changed", () => {
    const onRefetch = jest.fn();
    renderUseRealtimeMatches({ enabled: true, onRefetch });

    mockSockets[0].emit("message", { data: JSON.stringify({ type: "other" }) });

    expect(onRefetch).not.toHaveBeenCalled();
  });

  it("reconecta con backoff exponencial tras un close", () => {
    renderUseRealtimeMatches({ enabled: true, onRefetch: jest.fn() });

    expect(mockSockets).toHaveLength(1);
    mockSockets[0].emit("close", {});

    // Delay inicial: 1000ms (DEFAULT_INITIAL_DELAY_MS)
    jest.advanceTimersByTime(999);
    expect(mockSockets).toHaveLength(1);
    jest.advanceTimersByTime(1);
    expect(mockSockets).toHaveLength(2);
  });

  it("deja de reconectar tras el unmount (cleanup)", () => {
    const { unmount } = renderUseRealtimeMatches({ enabled: true, onRefetch: jest.fn() });

    unmount();
    jest.advanceTimersByTime(30000);

    // Solo el socket inicial — el unmount cancela el reconnect pendiente.
    expect(mockSockets).toHaveLength(1);
  });

  it("no loguea un error de socket disparado por el cierre intencional del unmount", () => {
    // Repro del bug reportado en manual QA (KAN-150/258): React Strict Mode en dev hace un
    // mount→cleanup→mount inmediato, y el cleanup cierra el socket todavía en CONNECTING — el
    // navegador dispara un `error` real ahí (spec de WebSocket), pero no hay ningún problema de
    // conectividad real, así que no debe ensuciar la consola.
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    const { unmount } = renderUseRealtimeMatches({ enabled: true, onRefetch: jest.fn() });

    const socket = mockSockets[0];
    unmount();
    socket.emit("error", {});

    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it("sigue logueando un error de socket real durante una sesión activa", () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    renderUseRealtimeMatches({ enabled: true, onRefetch: jest.fn() });

    mockSockets[0].emit("error", {});

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[REALTIME] Error en el socket compartido del dashboard:",
      {},
    );
    consoleErrorSpy.mockRestore();
  });

  it("llama a onRefetch en cada tick del polling de respaldo", () => {
    const onRefetch = jest.fn();
    renderUseRealtimeMatches({ enabled: true, onRefetch });

    // El intervalo de polling cae en [15s, 30s) — 30s cubre el peor caso.
    jest.advanceTimersByTime(30000);

    expect(onRefetch).toHaveBeenCalled();
  });

  it("reporta métricas a /api/dashboard-metrics cada 60s", async () => {
    renderUseRealtimeMatches({ enabled: true, onRefetch: jest.fn() });

    await jest.advanceTimersByTimeAsync(60000);

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/dashboard-metrics",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("no reporta métricas si el usuario está inactivo (KAN-256)", async () => {
    const isActive = jest.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");

    renderUseRealtimeMatches({ enabled: true, onRefetch: jest.fn() });

    await jest.advanceTimersByTimeAsync(60000);

    expect(global.fetch).not.toHaveBeenCalledWith("/api/dashboard-metrics", expect.anything());

    isActive.mockRestore();
  });

  it("vuelve a reportar métricas (acumuladas) cuando el usuario vuelve a estar activo", async () => {
    const visibility = jest.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");

    renderUseRealtimeMatches({ enabled: true, onRefetch: jest.fn() });

    await jest.advanceTimersByTimeAsync(60000);
    expect(global.fetch).not.toHaveBeenCalledWith("/api/dashboard-metrics", expect.anything());

    visibility.mockReturnValue("visible");
    await jest.advanceTimersByTimeAsync(60000);

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/dashboard-metrics",
      expect.objectContaining({ method: "POST" }),
    );

    visibility.mockRestore();
  });
});
