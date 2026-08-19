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

const PENDING_SHEET = {
  sheetName: "Hoja1",
  headers: ["Dirección", "Costo"],
  headerSignature: "costo|dirección",
  source: "heuristic" as const,
  fields: [],
  unresolvedRequiredFields: ["domicilio", "precio"],
  ambiguousFields: [],
};

async function uploadIntoNeedsMapping(fetchMock: jest.Mock) {
  fetchMock.mockResolvedValueOnce(
    mockResponse({
      ok: true,
      status: 200,
      body: { requiresMappingConfirmation: true, sheets: [PENDING_SHEET] },
    }),
  );
  const { result } = renderHook(() => useUpload());
  await act(async () => {
    await result.current.upload(excelFile());
  });
  await waitFor(() => expect(result.current.status).toBe("needs-mapping"));
  return result;
}

describe("useUpload#confirmMapping (KAN-217)", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("confirma el mapeo con POST /api/upload/confirm-mapping (mismo archivo + mappings) y pasa a success", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    const result = await uploadIntoNeedsMapping(fetchMock);

    fetchMock.mockResolvedValueOnce(
      mockResponse({
        ok: true,
        status: 200,
        body: { success: true, count: 5, priceParseErrors: [] },
      }),
    );

    await act(async () => {
      await result.current.confirmMapping({ Hoja1: { domicilio: "Dirección", precio: "Costo" } });
    });

    await waitFor(() => expect(result.current.status).toBe("success"));
    expect(result.current.result).toEqual({ success: true, count: 5, priceParseErrors: [] });
    expect(result.current.pendingSheets).toEqual([]);

    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("/api/upload/confirm-mapping");
    expect(init.method).toBe("POST");
    expect(init.body).toBeInstanceOf(FormData);
    expect((init.body as FormData).get("mappings")).toBe(
      JSON.stringify({ Hoja1: { domicilio: "Dirección", precio: "Costo" } }),
    );
  });

  it("si el backend rechaza el mapeo confirmado, se queda en needs-mapping con confirmError seteado", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    const result = await uploadIntoNeedsMapping(fetchMock);

    fetchMock.mockResolvedValueOnce(
      mockResponse({
        ok: false,
        status: 400,
        body: { error: "El mapeo confirmado no resuelve los campos requeridos: precio" },
      }),
    );

    await act(async () => {
      await result.current.confirmMapping({ Hoja1: { domicilio: "Dirección" } });
    });

    await waitFor(() =>
      expect(result.current.confirmError).toBe(
        "El mapeo confirmado no resuelve los campos requeridos: precio",
      ),
    );
    expect(result.current.status).toBe("needs-mapping");
    expect(result.current.pendingSheets).toEqual([PENDING_SHEET]);
  });

  it("reset() limpia confirmError y confirming además del resto del estado", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    const result = await uploadIntoNeedsMapping(fetchMock);

    fetchMock.mockResolvedValueOnce(mockResponse({ ok: false, status: 400, body: { error: "x" } }));
    await act(async () => {
      await result.current.confirmMapping({});
    });
    await waitFor(() => expect(result.current.confirmError).toBe("x"));

    act(() => {
      result.current.reset();
    });

    expect(result.current.status).toBe("idle");
    expect(result.current.confirmError).toBeNull();
    expect(result.current.confirming).toBe(false);
  });
});
