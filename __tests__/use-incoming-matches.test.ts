import { act, renderHook, waitFor } from "@testing-library/react";
import { useIncomingMatches } from "@/lib/use-incoming-matches";

function mockResponse(init: { ok: boolean; status: number; body?: unknown }): Response {
  return {
    ok: init.ok,
    status: init.status,
    text: async () => (init.body !== undefined ? JSON.stringify(init.body) : ""),
  } as Response;
}

const SAMPLE_INCOMING_MATCH = {
  id: "im1",
  fecha: "2026-01-01",
  searchText: "depto 2 dorm",
  searcherContact: {
    full_name: "Juana Pérez",
    phone_number: "+54 381 555-5555",
    agency_name: "Inmobiliaria Test",
    email: "juana@example.com",
  },
  property: { domicilio: "Calle Falsa 123", precio: 1000, moneda: "USD", operacion: "alquiler" },
  reasons: [],
  score: 70,
};

describe("useIncomingMatches (KAN-190)", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("carga los interesados al montar (GET /api/matches/incoming)", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        mockResponse({ ok: true, status: 200, body: { matches: [SAMPLE_INCOMING_MATCH] } }),
      );

    const { result } = renderHook(() => useIncomingMatches());

    await waitFor(() => expect(result.current.status).toBe("loaded"));
    expect(result.current.matches).toEqual([SAMPLE_INCOMING_MATCH]);
    expect(global.fetch).toHaveBeenCalledWith("/api/matches/incoming", expect.objectContaining({}));
  });

  it("pasa a status=error si GET /api/matches/incoming falla", async () => {
    global.fetch = jest.fn().mockResolvedValue(mockResponse({ ok: false, status: 500, body: {} }));

    const { result } = renderHook(() => useIncomingMatches());

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBeTruthy();
  });

  it("refetch vuelve a pedir el endpoint", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(mockResponse({ ok: true, status: 200, body: { matches: [] } }))
      .mockResolvedValueOnce(
        mockResponse({ ok: true, status: 200, body: { matches: [SAMPLE_INCOMING_MATCH] } }),
      );
    global.fetch = fetchMock;

    const { result } = renderHook(() => useIncomingMatches());
    await waitFor(() => expect(result.current.status).toBe("loaded"));
    expect(result.current.matches).toEqual([]);

    await act(async () => {
      await result.current.refetch();
    });

    expect(result.current.matches).toEqual([SAMPLE_INCOMING_MATCH]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
