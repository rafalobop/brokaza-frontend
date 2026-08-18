import { renderHook } from "@testing-library/react";
import { useRealtimeMatches } from "@/lib/use-realtime-matches";

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
    renderHook(() => useRealtimeMatches({ enabled: true, onRefetch: jest.fn() }));

    expect(mockSockets).toHaveLength(1);
    expect(mockSockets[0].url).toBe("ws://localhost/ws");
  });

  it("no abre el socket cuando enabled=false", () => {
    renderHook(() => useRealtimeMatches({ enabled: false, onRefetch: jest.fn() }));

    expect(mockSockets).toHaveLength(0);
  });

  it("llama a onRefetch cuando llega un mensaje match_count_changed", () => {
    const onRefetch = jest.fn().mockResolvedValue(undefined);
    renderHook(() => useRealtimeMatches({ enabled: true, onRefetch }));

    const socket = mockSockets[0];
    socket.readyState = MockWebSocket.OPEN;
    socket.emit("open", {});
    socket.emit("message", { data: JSON.stringify({ type: "match_count_changed" }) });

    expect(onRefetch).toHaveBeenCalledTimes(1);
  });

  it("ignora mensajes que no son match_count_changed", () => {
    const onRefetch = jest.fn();
    renderHook(() => useRealtimeMatches({ enabled: true, onRefetch }));

    mockSockets[0].emit("message", { data: JSON.stringify({ type: "other" }) });

    expect(onRefetch).not.toHaveBeenCalled();
  });

  it("reconecta con backoff exponencial tras un close", () => {
    renderHook(() => useRealtimeMatches({ enabled: true, onRefetch: jest.fn() }));

    expect(mockSockets).toHaveLength(1);
    mockSockets[0].emit("close", {});

    // Delay inicial: 1000ms (DEFAULT_INITIAL_DELAY_MS)
    jest.advanceTimersByTime(999);
    expect(mockSockets).toHaveLength(1);
    jest.advanceTimersByTime(1);
    expect(mockSockets).toHaveLength(2);
  });

  it("deja de reconectar tras el unmount (cleanup)", () => {
    const { unmount } = renderHook(() =>
      useRealtimeMatches({ enabled: true, onRefetch: jest.fn() }),
    );

    unmount();
    jest.advanceTimersByTime(30000);

    // Solo el socket inicial — el unmount cancela el reconnect pendiente.
    expect(mockSockets).toHaveLength(1);
  });

  it("llama a onRefetch en cada tick del polling de respaldo", () => {
    const onRefetch = jest.fn();
    renderHook(() => useRealtimeMatches({ enabled: true, onRefetch }));

    // El intervalo de polling cae en [15s, 30s) — 30s cubre el peor caso.
    jest.advanceTimersByTime(30000);

    expect(onRefetch).toHaveBeenCalled();
  });

  it("reporta métricas a /api/dashboard-metrics cada 60s", async () => {
    renderHook(() => useRealtimeMatches({ enabled: true, onRefetch: jest.fn() }));

    await jest.advanceTimersByTimeAsync(60000);

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/dashboard-metrics",
      expect.objectContaining({ method: "POST" }),
    );
  });
});
