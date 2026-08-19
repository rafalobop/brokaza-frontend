import { adminApiClient } from "@/lib/admin-api-client";

function mockResponse(init: { ok: boolean; status: number; body?: string }): Response {
  return {
    ok: init.ok,
    status: init.status,
    text: async () => init.body ?? "",
  } as Response;
}

describe("adminApiClient (KAN-239)", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("antepone /admin al path antes de delegar en apiClient", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(mockResponse({ ok: true, status: 200, body: JSON.stringify({ ok: true }) }));
    global.fetch = fetchMock;

    await adminApiClient("/api/auth/session");

    expect(fetchMock).toHaveBeenCalledWith(
      "/admin/api/auth/session",
      expect.objectContaining({}),
    );
  });

  it("propaga el body parseado (misma semántica que apiClient)", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        mockResponse({ ok: true, status: 200, body: JSON.stringify({ authenticated: true }) }),
      );

    const result = await adminApiClient<{ authenticated: boolean }>("/api/auth/session");

    expect(result).toEqual({ authenticated: true });
  });
});
