import { act, renderHook, waitFor } from "@testing-library/react";
import { useUpload } from "@/lib/use-upload";

/** Mismo mock mínimo que `use-upload-progress.test.ts`/`use-realtime-matches.test.tsx` (KAN-187). */
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

  removeEventListener(type: string, listener: (event: unknown) => void) {
    this.listeners[type] = (this.listeners[type] ?? []).filter((l) => l !== listener);
  }

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

// KAN-338: `emit("done", ...)` en el socket mock simula el resultado real llegando por WS —
// desde este ticket, la respuesta HTTP de `POST /api/upload` ya no lo trae (solo `{accepted:true}`).
function emitDone(socket: MockWebSocket, doneResult: Record<string, unknown>) {
  socket.emit("message", {
    data: JSON.stringify({ type: "upload_status", stage: "done", ...doneResult }),
  });
}

describe("useUpload (KAN-216/338)", () => {
  const originalFetch = global.fetch;
  const originalWebSocket = global.WebSocket;

  beforeEach(() => {
    mockSockets = [];
    // @ts-expect-error -- mock deliberado del WebSocket global, mismo criterio que KAN-187
    global.WebSocket = MockWebSocket;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    global.WebSocket = originalWebSocket;
  });

  it("rechaza un archivo sin extensión .xlsx sin llamar a fetch", async () => {
    global.fetch = jest.fn();
    const { result } = renderHook(() => useUpload());

    await act(async () => {
      await result.current.upload(new File(["x"], "cartera.csv"));
    });

    expect(result.current.status).toBe("error");
    expect(result.current.error).toBe("Solo se permiten archivos Excel (.xlsx).");
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("sube un .xlsx válido: la respuesta HTTP solo confirma la aceptación, y el resultado llega por WS en 'done' (KAN-338)", async () => {
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

    await act(async () => {
      await uploadPromise;
    });

    // La respuesta HTTP ya volvió, pero el resultado final todavía no llegó por WS.
    expect(result.current.status).toBe("uploading");
    expect(mockSockets[0].closed).toBe(false);

    act(() => {
      emitDone(mockSockets[0], { count: 12, priceParseErrors: [], loaded: [], failed: [] });
    });

    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.result).toEqual({
      success: true,
      count: 12,
      priceParseErrors: [],
      loaded: [],
      failed: [],
    });
    expect(mockSockets[0].closed).toBe(true);

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("/api/upload");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    // FormData no fuerza Content-Type (KAN-155) — el browser arma el boundary.
    expect(init.headers["Content-Type"]).toBeUndefined();
  });

  it("si el socket se cae antes de recibir 'done'/'error', pasa a status=error en vez de quedar esperando para siempre (KAN-338)", async () => {
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
    await act(async () => {
      await uploadPromise;
    });
    expect(result.current.status).toBe("uploading");

    act(() => {
      mockSockets[0].emit("close", {});
    });

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toMatch(/conexión en tiempo real/i);
  });

  it("pasa a status=needs-mapping cuando el backend pide confirmar el mapeo de columnas (KAN-84)", async () => {
    const sheets = [
      {
        sheetName: "Hoja1",
        headers: ["Dirección", "Costo"],
        headerSignature: "costo|dirección",
        source: "heuristic",
        fields: [],
        unresolvedRequiredFields: ["domicilio", "precio"],
        ambiguousFields: [],
      },
    ];
    global.fetch = jest.fn().mockResolvedValue(
      mockResponse({
        ok: true,
        status: 200,
        body: { requiresMappingConfirmation: true, sheets },
      }),
    );

    const { result } = renderHook(() => useUpload());

    await act(async () => {
      await result.current.upload(excelFile());
    });

    await waitFor(() => expect(result.current.status).toBe("needs-mapping"));
    expect(result.current.pendingSheets).toEqual(sheets);
  });

  it("pasa a status=error con el mensaje del backend si la subida falla", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockResponse({
        ok: false,
        status: 413,
        body: { error: "El archivo supera el tamaño máximo permitido (10MB)." },
      }),
    );

    const { result } = renderHook(() => useUpload());

    await act(async () => {
      await result.current.upload(excelFile());
    });

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("El archivo supera el tamaño máximo permitido (10MB).");
  });

  it("reset() vuelve a status=idle y limpia error/result/pendingSheets", async () => {
    global.fetch = jest.fn().mockResolvedValue(mockResponse({ ok: false, status: 500, body: {} }));

    const { result } = renderHook(() => useUpload());

    await act(async () => {
      await result.current.upload(excelFile());
    });
    await waitFor(() => expect(result.current.status).toBe("error"));

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
    expect(result.current.result).toBeNull();
    expect(result.current.pendingSheets).toEqual([]);
  });
});
