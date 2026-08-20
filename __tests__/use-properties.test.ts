import { act, renderHook, waitFor } from "@testing-library/react";
import { useProperties } from "@/lib/use-properties";

function mockResponse(init: { ok: boolean; status: number; body?: unknown }): Response {
  return {
    ok: init.ok,
    status: init.status,
    text: async () => (init.body !== undefined ? JSON.stringify(init.body) : ""),
  } as Response;
}

const SAMPLE_PROPERTY = {
  id: "p1",
  address: "Calle Falsa 123",
  latitude: -26.82,
  longitude: -65.2,
  zone: { id: "z1", name: "Barrio Sur", group_id: null },
  zoneSource: "point" as const,
  textSuggestedZone: null,
  hasDiscrepancy: false,
};

describe("useProperties (KAN-240)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => {
    jest.useRealTimers();
    global.fetch = originalFetch;
  });

  it("carga la página 1 al montar", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockResponse({
        ok: true,
        status: 200,
        body: { properties: [SAMPLE_PROPERTY], page: 1, pageSize: 50, total: 1 },
      }),
    );

    const { result } = renderHook(() => useProperties());

    await waitFor(() => expect(result.current.status).toBe("loaded"));
    expect(result.current.properties).toEqual([SAMPLE_PROPERTY]);
    expect(result.current.totalPages).toBe(1);
    expect(global.fetch).toHaveBeenCalledWith(
      "/admin/api/properties?page=1",
      expect.objectContaining({}),
    );
  });

  it("pasa a status=error si falla la carga", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        mockResponse({ ok: false, status: 500, body: { error: "Error interno." } }),
      );

    const { result } = renderHook(() => useProperties());

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("Error interno.");
  });

  it("setSearch debounce (350ms), resetea a página 1 y espera antes de pegarle a la red", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        mockResponse({
          ok: true,
          status: 200,
          body: { properties: [], page: 1, pageSize: 50, total: 0 },
        }),
      );
    global.fetch = fetchMock;

    const { result } = renderHook(() => useProperties());
    await waitFor(() => expect(result.current.status).toBe("loaded"));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.setSearch("Falsa");
    });
    expect(result.current.search).toBe("Falsa");
    // No debería haber pegado a la red todavía — está esperando el debounce.
    expect(fetchMock).toHaveBeenCalledTimes(1);

    act(() => {
      jest.advanceTimersByTime(350);
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/admin/api/properties?page=1&search=Falsa",
      expect.objectContaining({}),
    );
  });

  it("teclas rápidas coalescen en una sola request con el último término", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        mockResponse({
          ok: true,
          status: 200,
          body: { properties: [], page: 1, pageSize: 50, total: 0 },
        }),
      );
    global.fetch = fetchMock;

    const { result } = renderHook(() => useProperties());
    await waitFor(() => expect(result.current.status).toBe("loaded"));

    act(() => {
      result.current.setSearch("F");
      result.current.setSearch("Fa");
      result.current.setSearch("Fal");
    });

    act(() => {
      jest.advanceTimersByTime(350);
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/admin/api/properties?page=1&search=Fal",
      expect.objectContaining({}),
    );
  });

  it("nextPage/prevPage respetan los límites (no pega a la red fuera de rango)", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        mockResponse({
          ok: true,
          status: 200,
          body: { properties: [], page: 1, pageSize: 50, total: 10 },
        }),
      );
    global.fetch = fetchMock;

    const { result } = renderHook(() => useProperties());
    await waitFor(() => expect(result.current.status).toBe("loaded"));
    expect(result.current.totalPages).toBe(1);

    act(() => {
      result.current.nextPage();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1); // no avanzó, ya está en la última página

    act(() => {
      result.current.prevPage();
    });
    expect(fetchMock).toHaveBeenCalledTimes(1); // no retrocedió, ya está en la primera página
  });

  it("nextPage pide la página siguiente cuando hay más de una", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        mockResponse({
          ok: true,
          status: 200,
          body: { properties: [], page: 1, pageSize: 50, total: 120 },
        }),
      );
    global.fetch = fetchMock;

    const { result } = renderHook(() => useProperties());
    await waitFor(() => expect(result.current.status).toBe("loaded"));
    expect(result.current.totalPages).toBe(3);

    fetchMock.mockResolvedValueOnce(
      mockResponse({
        ok: true,
        status: 200,
        body: { properties: [], page: 2, pageSize: 50, total: 120 },
      }),
    );

    act(() => {
      result.current.nextPage();
    });

    await waitFor(() => expect(result.current.page).toBe(2));
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/admin/api/properties?page=2",
      expect.objectContaining({}),
    );
  });
});
