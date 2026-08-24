import { act, renderHook, waitFor } from "@testing-library/react";
import { useActiveSearches } from "@/lib/use-active-searches";

function mockResponse(init: { ok: boolean; status: number; body?: unknown }): Response {
  return {
    ok: init.ok,
    status: init.status,
    text: async () => (init.body !== undefined ? JSON.stringify(init.body) : ""),
  } as Response;
}

const SAMPLE_SEARCH = {
  id: "s1",
  raw_text: "busco depto 2 dorm en alquiler",
  criteria: { operation: "alquiler", zones: ["Barrio Sur"] },
  status: "active",
  created_at: "2026-01-01T00:00:00.000Z",
  expires_at: "2026-01-08T00:00:00.000Z",
  days_remaining: 5,
  matches_count: 2,
};

describe("useActiveSearches (KAN-191)", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("carga las búsquedas activas al montar (GET /api/searches)", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        mockResponse({ ok: true, status: 200, body: { searches: [SAMPLE_SEARCH] } }),
      );

    const { result } = renderHook(() => useActiveSearches());

    await waitFor(() => expect(result.current.status).toBe("loaded"));
    expect(result.current.searches).toEqual([SAMPLE_SEARCH]);
    expect(global.fetch).toHaveBeenCalledWith("/api/searches", expect.objectContaining({}));
  });

  it("pasa a status=error si GET /api/searches falla", async () => {
    global.fetch = jest.fn().mockResolvedValue(mockResponse({ ok: false, status: 500, body: {} }));

    const { result } = renderHook(() => useActiveSearches());

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBeTruthy();
  });

  it("archive llama a DELETE /api/searches/:id y refetchea", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        mockResponse({ ok: true, status: 200, body: { searches: [SAMPLE_SEARCH] } }),
      )
      .mockResolvedValueOnce(mockResponse({ ok: true, status: 200, body: { success: true } }))
      .mockResolvedValueOnce(mockResponse({ ok: true, status: 200, body: { searches: [] } }));
    global.fetch = fetchMock;

    const { result } = renderHook(() => useActiveSearches());
    await waitFor(() => expect(result.current.status).toBe("loaded"));

    await act(async () => {
      await result.current.archive("s1");
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [archiveUrl, archiveInit] = fetchMock.mock.calls[1];
    expect(archiveUrl).toBe("/api/searches/s1");
    expect(archiveInit).toMatchObject({ method: "DELETE" });
    expect(result.current.searches).toEqual([]);
  });

  it("reactivate llama a POST /api/searches/:id/reactivate y refetchea", async () => {
    const reactivated = { ...SAMPLE_SEARCH, status: "active", days_remaining: 7 };
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        mockResponse({
          ok: true,
          status: 200,
          body: { searches: [{ ...SAMPLE_SEARCH, status: "expired", days_remaining: 0 }] },
        }),
      )
      .mockResolvedValueOnce(
        mockResponse({
          ok: true,
          status: 200,
          body: { success: true, expires_at: "2026-01-15T00:00:00.000Z" },
        }),
      )
      .mockResolvedValueOnce(
        mockResponse({ ok: true, status: 200, body: { searches: [reactivated] } }),
      );
    global.fetch = fetchMock;

    const { result } = renderHook(() => useActiveSearches());
    await waitFor(() => expect(result.current.status).toBe("loaded"));

    await act(async () => {
      await result.current.reactivate("s1");
    });

    const [reactivateUrl, reactivateInit] = fetchMock.mock.calls[1];
    expect(reactivateUrl).toBe("/api/searches/s1/reactivate");
    expect(reactivateInit).toMatchObject({ method: "POST" });
    expect(result.current.searches[0].status).toBe("active");
  });
});
