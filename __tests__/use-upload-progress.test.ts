import { act, renderHook, waitFor } from "@testing-library/react";
import { useUpload } from "@/lib/use-upload";

/** Mismo mock mínimo que `use-realtime-matches.test.tsx` (KAN-187) — sin conexión real. */
class MockWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;
  listeners: Record<string, Array<(event: unknown) => void>> = {};
  closed = false;

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
    this.closed = true;
  }

  emit(type: string, event: unknown) {
    (this.listeners[type] ?? []).forEach((listener) => listener(event));
  }
}

let mockSockets: MockWebSocket[] = [];

function mockResponse(init: { ok: boolean; status: number; body?: unknown }): Response {
  return {
    ok: init.ok,
    status: init.status,
    text: async () => (init.body !== undefined ? JSON.stringify(init.body) : ""),
  } as Response;
}

function excelFile(name = "cartera.xlsx"): File {
  return new File(["contenido"], name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

describe("useUpload — barra de progreso vía WS (KAN-218)", () => {
  const originalFetch = global.fetch;
  const originalWebSocket = global.WebSocket;

  beforeEach(() => {
    mockSockets = [];
    // @ts-expect-error -- mock deliberado del WebSocket global, mismo criterio que KAN-187
    global.WebSocket = MockWebSocket;
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    global.fetch = originalFetch;
    global.WebSocket = originalWebSocket;
  });

  it("abre un socket a /ws al empezar a subir y lo cierra cuando llega 'done' (KAN-338)", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockResponse({
        ok: true,
        status: 202,
        body: { accepted: true, message: "Tu cartera se está sincronizando." },
      }),
    );

    const { result } = renderHook(() => useUpload());

    let uploadPromise!: Promise<void>;
    act(() => {
      uploadPromise = result.current.upload(excelFile());
    });

    expect(mockSockets).toHaveLength(1);
    expect(mockSockets[0].url).toBe("ws://localhost/ws");
    expect(mockSockets[0].closed).toBe(false);

    await act(async () => {
      await uploadPromise;
    });

    // La respuesta HTTP ya volvió (aceptada), pero el socket sigue abierto: el resultado real
    // todavía no llegó.
    expect(mockSockets[0].closed).toBe(false);

    act(() => {
      mockSockets[0].emit("message", {
        data: JSON.stringify({
          type: "upload_status",
          stage: "done",
          count: 1,
          priceParseErrors: [],
          loaded: [],
          failed: [],
        }),
      });
    });

    expect(mockSockets[0].closed).toBe(true);
  });

  it("actualiza `stage` (debounced) a medida que llegan eventos upload_status", async () => {
    let resolveFetch!: (value: Response) => void;
    global.fetch = jest.fn().mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const { result } = renderHook(() => useUpload());

    act(() => {
      void result.current.upload(excelFile());
    });
    expect(mockSockets).toHaveLength(1);
    const socket = mockSockets[0];

    act(() => {
      socket.emit("message", {
        data: JSON.stringify({ type: "upload_status", stage: "parsing_headers" }),
      });
    });
    act(() => {
      jest.advanceTimersByTime(150);
    });
    expect(result.current.stage).toBe("parsing_headers");

    act(() => {
      socket.emit("message", {
        data: JSON.stringify({ type: "upload_status", stage: "syncing_database" }),
      });
    });
    act(() => {
      jest.advanceTimersByTime(150);
    });
    expect(result.current.stage).toBe("syncing_database");

    resolveFetch(
      mockResponse({
        ok: true,
        status: 202,
        body: { accepted: true, message: "Tu cartera se está sincronizando." },
      }),
    );
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      socket.emit("message", {
        data: JSON.stringify({
          type: "upload_status",
          stage: "done",
          count: 1,
          priceParseErrors: [],
          loaded: [],
          failed: [],
        }),
      });
    });
    await waitFor(() => expect(result.current.status).toBe("success"));
  });

  it("coalesce una ráfaga de eventos en la última etapa (debounce, sin ejecutar N re-renders)", async () => {
    let resolveFetch!: (value: Response) => void;
    global.fetch = jest.fn().mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveFetch = resolve;
      }),
    );

    const { result } = renderHook(() => useUpload());
    act(() => {
      void result.current.upload(excelFile());
    });
    const socket = mockSockets[0];

    act(() => {
      socket.emit("message", {
        data: JSON.stringify({ type: "upload_status", stage: "parsing_headers" }),
      });
      socket.emit("message", {
        data: JSON.stringify({ type: "upload_status", stage: "resolving_column_mapping" }),
      });
      socket.emit("message", {
        data: JSON.stringify({ type: "upload_status", stage: "parsing_rows" }),
      });
    });

    // Antes de que venza el debounce, `stage` todavía no se actualizó ninguna vez.
    expect(result.current.stage).toBeNull();

    act(() => {
      jest.advanceTimersByTime(150);
    });
    expect(result.current.stage).toBe("parsing_rows");

    resolveFetch(
      mockResponse({
        ok: true,
        status: 202,
        body: { accepted: true, message: "Tu cartera se está sincronizando." },
      }),
    );
    await act(async () => {
      await Promise.resolve();
    });
    act(() => {
      socket.emit("message", {
        data: JSON.stringify({
          type: "upload_status",
          stage: "done",
          count: 1,
          priceParseErrors: [],
          loaded: [],
          failed: [],
        }),
      });
    });
    await waitFor(() => expect(result.current.status).toBe("success"));
  });

  it("ignora mensajes que no son upload_status", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockResponse({
        ok: true,
        status: 202,
        body: { accepted: true, message: "Tu cartera se está sincronizando." },
      }),
    );

    const { result } = renderHook(() => useUpload());
    act(() => {
      void result.current.upload(excelFile());
    });
    const socket = mockSockets[0];

    act(() => {
      socket.emit("message", { data: JSON.stringify({ type: "match_count_changed" }) });
      jest.advanceTimersByTime(150);
    });

    expect(result.current.stage).toBeNull();
  });

  it("reset() vuelve stage a null", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockResponse({
        ok: true,
        status: 202,
        body: { accepted: true, message: "Tu cartera se está sincronizando." },
      }),
    );

    const { result } = renderHook(() => useUpload());
    act(() => {
      void result.current.upload(excelFile());
    });
    const socket = mockSockets[0];
    act(() => {
      socket.emit("message", {
        data: JSON.stringify({
          type: "upload_status",
          stage: "done",
          count: 1,
          priceParseErrors: [],
          loaded: [],
          failed: [],
        }),
      });
      jest.advanceTimersByTime(150);
    });
    await waitFor(() => expect(result.current.status).toBe("success"));

    act(() => {
      result.current.reset();
    });

    expect(result.current.stage).toBeNull();
  });
});
