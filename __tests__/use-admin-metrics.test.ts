import { act, renderHook, waitFor } from "@testing-library/react";
import { useAdminMetrics } from "@/lib/use-admin-metrics";

function mockResponse(init: { ok: boolean; status: number; body?: unknown }): Response {
  return {
    ok: init.ok,
    status: init.status,
    text: async () => (init.body !== undefined ? JSON.stringify(init.body) : ""),
  } as Response;
}

const SAMPLE_METRICS = {
  totalMatches: 12,
  registeredUsers: 8,
  activeUsers: 3,
  activeUsersDefinition: "Tenants con al menos una búsqueda activa",
  totalProperties: 40,
  agentsWithPortfolio: 5,
  agentsWithSearch: 6,
  mrr: null,
  churn: null,
  billingNote: "Pendiente — sin cobros integrados todavía.",
};

describe("useAdminMetrics (KAN-342)", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  it("carga las métricas, incluidas agentsWithPortfolio y agentsWithSearch, desde /admin/api/metrics", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(mockResponse({ ok: true, status: 200, body: SAMPLE_METRICS }));

    const { result } = renderHook(() => useAdminMetrics());

    await waitFor(() => expect(result.current.status).toBe("loaded"));
    expect(result.current.metrics).toEqual(SAMPLE_METRICS);
    expect(global.fetch).toHaveBeenCalledWith(
      "/admin/api/metrics",
      expect.objectContaining({}),
    );
  });

  it("pasa a status=error si GET /admin/api/metrics falla", async () => {
    global.fetch = jest.fn().mockResolvedValue(mockResponse({ ok: false, status: 500, body: {} }));

    const { result } = renderHook(() => useAdminMetrics());

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.metrics).toBeNull();
  });

  it("pollea /admin/api/metrics cada 10s, igual que el legacy (admin-dashboard/app.js)", async () => {
    jest.useFakeTimers();
    const fetchMock = jest
      .fn()
      .mockResolvedValue(mockResponse({ ok: true, status: 200, body: SAMPLE_METRICS }));
    global.fetch = fetchMock;

    renderHook(() => useAdminMetrics());

    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(10000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);

    await act(async () => {
      await jest.advanceTimersByTimeAsync(10000);
    });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
