import { renderHook, waitFor } from "@testing-library/react";
import { useMappingFields } from "@/lib/use-mapping-fields";

function mockResponse(init: { ok: boolean; status: number; body?: unknown }): Response {
  return {
    ok: init.ok,
    status: init.status,
    text: async () => (init.body !== undefined ? JSON.stringify(init.body) : ""),
  } as Response;
}

const SAMPLE_RESPONSE = {
  version: 1,
  fields: [
    "domicilio",
    "piso_lote",
    "precio",
    "expensas",
    "dormitorios",
    "caracteristicas",
    "contacto",
    "tipo",
    "operacion",
    "latitud",
    "longitud",
  ],
  required: ["domicilio", "precio"],
};

describe("useMappingFields (KAN-215)", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("carga el contrato de MAPPING_FIELDS al montar (GET /api/upload/mapping-fields)", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(mockResponse({ ok: true, status: 200, body: SAMPLE_RESPONSE }));

    const { result } = renderHook(() => useMappingFields());

    await waitFor(() => expect(result.current.status).toBe("loaded"));
    expect(result.current.version).toBe(1);
    expect(result.current.fields).toEqual(SAMPLE_RESPONSE.fields);
    expect(result.current.required).toEqual(["domicilio", "precio"]);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/upload/mapping-fields",
      expect.objectContaining({}),
    );
  });

  it("pasa a status=error si GET /api/upload/mapping-fields falla", async () => {
    global.fetch = jest.fn().mockResolvedValue(mockResponse({ ok: false, status: 500, body: {} }));

    const { result } = renderHook(() => useMappingFields());

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBeTruthy();
    expect(result.current.fields).toEqual([]);
  });
});
