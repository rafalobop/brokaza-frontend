import { act, renderHook, waitFor } from "@testing-library/react";
import { useUpload } from "@/lib/use-upload";

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

describe("useUpload (KAN-216)", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
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

  it("sube un .xlsx válido y expone status=success con el resultado (POST /api/upload multipart)", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockResponse({
        ok: true,
        status: 200,
        body: { success: true, count: 12, priceParseErrors: [] },
      }),
    );

    const { result } = renderHook(() => useUpload());

    await act(async () => {
      await result.current.upload(excelFile());
    });

    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.result).toEqual({ success: true, count: 12, priceParseErrors: [] });

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("/api/upload");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    // FormData no fuerza Content-Type (KAN-155) — el browser arma el boundary.
    expect(init.headers["Content-Type"]).toBeUndefined();
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
