import { act, renderHook } from "@testing-library/react";
import { RealtimeSocketProvider } from "@/lib/realtime-socket-context";
import { useRealtimeMatches } from "@/lib/use-realtime-matches";
import { useUpload } from "@/lib/use-upload";
import { DEFAULT_MAX_DELAY_MS, MAX_RECONNECT_ATTEMPTS } from "@/lib/realtime-matches";

/** Mismo mock mínimo que el resto de los tests de KAN-187/338. */
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
  }

  emit(type: string, event: unknown) {
    (this.listeners[type] ?? []).forEach((listener) => listener(event));
  }
}

let mockSockets: MockWebSocket[] = [];

/**
 * Repro directo del bug reportado (KAN-343): antes de esta consolidación, `useUpload` abría su
 * propio `new WebSocket` independiente del que `useRealtimeMatches` ya mantenía por sesión —
 * durante una subida de Excel la pestaña sostenía 2 conexiones idénticas a `/ws` en simultáneo.
 * Este test monta ambos hooks bajo el mismo `RealtimeSocketProvider` (igual que `MatchesProvider`
 * + `UploadDropzone` en la app real) y confirma que solo existe una conexión, antes y durante una
 * subida.
 */
describe("RealtimeSocketProvider — socket único compartido (KAN-343)", () => {
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

  it("useRealtimeMatches y useUpload comparten una única conexión, incluso durante una subida", async () => {
    function useDashboardConsumers() {
      useRealtimeMatches({ enabled: true, onRefetch: jest.fn() });
      return useUpload();
    }

    const { result } = renderHook(() => useDashboardConsumers(), {
      wrapper: ({ children }) => (
        <RealtimeSocketProvider enabled={true}>{children}</RealtimeSocketProvider>
      ),
    });

    // Un solo socket al montar ambos hooks.
    expect(mockSockets).toHaveLength(1);

    const file = new File(["contenido"], "cartera.xlsx", {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 202,
      text: async () =>
        JSON.stringify({ accepted: true, message: "Tu cartera se está sincronizando." }),
    });

    await act(async () => {
      await result.current.upload(file);
    });

    // Ni durante ni después de arrancar la subida se abrió una segunda conexión.
    expect(mockSockets).toHaveLength(1);
    expect(result.current.status).toBe("uploading");
  });

  /**
   * KAN-... : antes de este fix el `scheduleReconnect` de `RealtimeSocketProvider` no tenía techo
   * de intentos — reintentaba para siempre aunque el server estuviera caído. El polling de
   * respaldo ya cubre la función del WS, así que tras `MAX_RECONNECT_ATTEMPTS` fallidos
   * consecutivos el provider debe desistir y dejar de abrir nuevos sockets.
   */
  it("deja de reintentar la reconexión tras MAX_RECONNECT_ATTEMPTS fallos consecutivos", () => {
    renderHook(() => useRealtimeMatches({ enabled: true, onRefetch: jest.fn() }), {
      wrapper: ({ children }) => (
        <RealtimeSocketProvider enabled={true}>{children}</RealtimeSocketProvider>
      ),
    });

    expect(mockSockets).toHaveLength(1);

    // Cada cierre dispara un reconnect programado con backoff exponencial; avanzamos el timer lo
    // suficiente cada vez para que dispare, simulando fallos consecutivos.
    for (let i = 0; i < MAX_RECONNECT_ATTEMPTS; i++) {
      act(() => {
        mockSockets[mockSockets.length - 1].emit("close", {});
      });
      act(() => {
        jest.advanceTimersByTime(DEFAULT_MAX_DELAY_MS);
      });
    }

    // Se agotaron los reintentos: MAX_RECONNECT_ATTEMPTS reconexiones + el socket inicial.
    const socketCountAfterExhaustion = mockSockets.length;
    expect(socketCountAfterExhaustion).toBe(MAX_RECONNECT_ATTEMPTS + 1);

    // Un cierre adicional del último socket no debe programar ningún reintento más.
    act(() => {
      mockSockets[mockSockets.length - 1].emit("close", {});
    });
    act(() => {
      jest.advanceTimersByTime(DEFAULT_MAX_DELAY_MS * 2);
    });

    expect(mockSockets).toHaveLength(socketCountAfterExhaustion);
  });
});
