import { act, renderHook, waitFor } from "@testing-library/react";
import { useTenantProperties } from "@/lib/use-tenant-properties";
import type { TenantProperty } from "@/lib/tenant-properties-api";

function mockResponse(init: { ok: boolean; status: number; body?: unknown }): Response {
  return {
    ok: init.ok,
    status: init.status,
    text: async () => (init.body !== undefined ? JSON.stringify(init.body) : ""),
  } as Response;
}

const SAMPLE_PROPERTY: TenantProperty = {
  id: "p1",
  address: "Calle Falsa 123",
  floor: null,
  unit: null,
  block: null,
  lot: null,
  price: 1000,
  currency: "USD",
  maintenance_fees: 0,
  bedrooms: 2,
  features: null,
  contact_info: null,
  operation: "alquiler",
  property_type: "departamento",
  sheet_name: "Alta manual",
  latitude: null,
  longitude: null,
  needs_coordinate_review: false,
  zone: null,
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-01T00:00:00.000Z",
};

describe("useTenantProperties (KAN-273)", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("carga el listado al montar (GET /api/catalog/properties)", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        mockResponse({ ok: true, status: 200, body: { properties: [SAMPLE_PROPERTY], total: 1 } }),
      );

    const { result } = renderHook(() => useTenantProperties());

    await waitFor(() => expect(result.current.status).toBe("loaded"));
    expect(result.current.properties).toEqual([SAMPLE_PROPERTY]);
    expect(result.current.total).toBe(1);
    const [url] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toContain("/api/catalog/properties?");
  });

  it("pasa a status=error si el listado falla", async () => {
    global.fetch = jest.fn().mockResolvedValue(mockResponse({ ok: false, status: 500, body: {} }));

    const { result } = renderHook(() => useTenantProperties());

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBeTruthy();
  });

  it("setOperationFilter refetchea con el filtro y resetea a página 1", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        mockResponse({ ok: true, status: 200, body: { properties: [], total: 0 } }),
      );
    global.fetch = fetchMock;

    const { result } = renderHook(() => useTenantProperties());
    await waitFor(() => expect(result.current.status).toBe("loaded"));

    act(() => {
      result.current.setOperationFilter("venta");
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [url] = fetchMock.mock.calls[1];
    expect(url).toContain("operation=venta");
  });

  it("setPropertyTypeFilter refetchea con el filtro y resetea a página 1", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        mockResponse({ ok: true, status: 200, body: { properties: [], total: 0 } }),
      );
    global.fetch = fetchMock;

    const { result } = renderHook(() => useTenantProperties());
    await waitFor(() => expect(result.current.status).toBe("loaded"));

    act(() => {
      result.current.setPropertyTypeFilter("casa");
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    const [url] = fetchMock.mock.calls[1];
    expect(url).toContain("property_type=casa");
  });

  it("setSearch debounca (350ms) antes de refetchear con el término", async () => {
    jest.useFakeTimers();
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        mockResponse({ ok: true, status: 200, body: { properties: [], total: 0 } }),
      );
    global.fetch = fetchMock;

    const { result } = renderHook(() => useTenantProperties());
    await waitFor(() => expect(result.current.status).toBe("loaded"));

    act(() => {
      result.current.setSearch("Falsa");
    });
    // Todavía no debería haber refetcheado: el debounce no venció.
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(350);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [url] = fetchMock.mock.calls[1];
    expect(url).toContain("search=Falsa");
    jest.useRealTimers();
  });

  it("setSort ordena asc en la primera llamada y desc si se clickea la misma columna de nuevo", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        mockResponse({ ok: true, status: 200, body: { properties: [], total: 0 } }),
      );
    global.fetch = fetchMock;

    const { result } = renderHook(() => useTenantProperties());
    await waitFor(() => expect(result.current.status).toBe("loaded"));

    act(() => {
      result.current.setSort("price");
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1][0]).toContain("sort=price");
    expect(fetchMock.mock.calls[1][0]).toContain("order=asc");
    expect(result.current.sort).toBe("price");
    expect(result.current.order).toBe("asc");

    act(() => {
      result.current.setSort("price");
    });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    expect(fetchMock.mock.calls[2][0]).toContain("order=desc");
    expect(result.current.order).toBe("desc");
  });

  it("setOperationFilter con 'alquiler' manda el filtro correcto (discriminar venta/alquiler, AC7)", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        mockResponse({ ok: true, status: 200, body: { properties: [], total: 0 } }),
      );
    global.fetch = fetchMock;

    const { result } = renderHook(() => useTenantProperties());
    await waitFor(() => expect(result.current.status).toBe("loaded"));

    act(() => {
      result.current.setOperationFilter("alquiler");
    });

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock.mock.calls[1][0]).toContain("operation=alquiler");
  });

  it("createProperty hace POST y refetchea el listado", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        mockResponse({ ok: true, status: 200, body: { properties: [], total: 0 } }),
      )
      .mockResolvedValueOnce(
        mockResponse({ ok: true, status: 201, body: { property: SAMPLE_PROPERTY } }),
      )
      .mockResolvedValueOnce(
        mockResponse({ ok: true, status: 200, body: { properties: [SAMPLE_PROPERTY], total: 1 } }),
      );
    global.fetch = fetchMock;

    const { result } = renderHook(() => useTenantProperties());
    await waitFor(() => expect(result.current.status).toBe("loaded"));

    await act(async () => {
      await result.current.createProperty({
        address: "Calle Falsa 123",
        price: 1000,
        currency: "USD",
        operation: "alquiler",
        property_type: "departamento",
      });
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [postUrl, postInit] = fetchMock.mock.calls[1];
    expect(postUrl).toBe("/api/catalog/properties");
    expect(postInit.method).toBe("POST");
    expect(result.current.properties).toEqual([SAMPLE_PROPERTY]);
  });

  it("updateProperty en 409 devuelve el conflicto y actualiza la fila con el estado real", async () => {
    const conflictProperty: TenantProperty = {
      ...SAMPLE_PROPERTY,
      price: 2000,
      updated_at: "2026-08-02T00:00:00.000Z",
    };
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        mockResponse({ ok: true, status: 200, body: { properties: [SAMPLE_PROPERTY], total: 1 } }),
      )
      .mockResolvedValueOnce(
        mockResponse({
          ok: false,
          status: 409,
          body: { error: "conflicto", property: conflictProperty },
        }),
      );
    global.fetch = fetchMock;

    const { result } = renderHook(() => useTenantProperties());
    await waitFor(() => expect(result.current.status).toBe("loaded"));

    let outcome: { conflict: TenantProperty | null } | undefined;
    await act(async () => {
      outcome = await result.current.updateProperty("p1", {
        price: 1500,
        expectedUpdatedAt: SAMPLE_PROPERTY.updated_at,
      });
    });

    expect(outcome?.conflict).toEqual(conflictProperty);
    expect(result.current.properties[0]).toEqual(conflictProperty);
  });

  it("deleteProperty hace DELETE y quita la fila del estado local sin refetch", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        mockResponse({ ok: true, status: 200, body: { properties: [SAMPLE_PROPERTY], total: 1 } }),
      )
      .mockResolvedValueOnce(mockResponse({ ok: true, status: 200, body: { success: true } }));
    global.fetch = fetchMock;

    const { result } = renderHook(() => useTenantProperties());
    await waitFor(() => expect(result.current.status).toBe("loaded"));

    await act(async () => {
      await result.current.deleteProperty("p1");
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [deleteUrl, deleteInit] = fetchMock.mock.calls[1];
    expect(deleteUrl).toBe("/api/catalog/properties/p1");
    expect(deleteInit.method).toBe("DELETE");
    expect(result.current.properties).toEqual([]);
    expect(result.current.total).toBe(0);
  });
});
