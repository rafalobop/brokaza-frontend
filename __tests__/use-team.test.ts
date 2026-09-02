import { act, renderHook, waitFor } from "@testing-library/react";
import { useTeam } from "@/lib/use-team";

function mockResponse(init: { ok: boolean; status: number; body?: unknown }): Response {
  return {
    ok: init.ok,
    status: init.status,
    text: async () => (init.body !== undefined ? JSON.stringify(init.body) : ""),
  } as Response;
}

const SAMPLE_COLLABORATOR = {
  id: "c1",
  full_name: "Ana Gómez",
  email: "ana@example.com",
  license_number: "350",
  license_validation_status: "validated" as const,
  created_at: "2026-09-01T00:00:00.000Z",
};

describe("useTeam (KAN-306)", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("carga el equipo al montar (GET /api/admin-panel/collaborators)", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        mockResponse({ ok: true, status: 200, body: { collaborators: [SAMPLE_COLLABORATOR] } }),
      );

    const { result } = renderHook(() => useTeam());

    await waitFor(() => expect(result.current.status).toBe("loaded"));
    expect(result.current.collaborators).toEqual([SAMPLE_COLLABORATOR]);
    expect(global.fetch).toHaveBeenCalledWith(
      "/api/admin-panel/collaborators",
      expect.objectContaining({}),
    );
  });

  it("un 403 (no-owner) pasa a status='forbidden', no 'error'", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockResponse({
        ok: false,
        status: 403,
        body: { error: "Solo los dueños de agencia pueden acceder al panel de administración." },
      }),
    );

    const { result } = renderHook(() => useTeam());

    await waitFor(() => expect(result.current.status).toBe("forbidden"));
    expect(result.current.error).toBe(
      "Solo los dueños de agencia pueden acceder al panel de administración.",
    );
  });

  it("un error que no es 403 pasa a status='error'", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(mockResponse({ ok: false, status: 500, body: { error: "Falló." } }));

    const { result } = renderHook(() => useTeam());

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("Falló.");
  });

  it("revoke llama a DELETE /api/admin-panel/collaborators/:id y refetchea", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        mockResponse({ ok: true, status: 200, body: { collaborators: [SAMPLE_COLLABORATOR] } }),
      )
      .mockResolvedValueOnce(mockResponse({ ok: true, status: 200, body: { success: true } }))
      .mockResolvedValueOnce(mockResponse({ ok: true, status: 200, body: { collaborators: [] } }));
    global.fetch = fetchMock;

    const { result } = renderHook(() => useTeam());
    await waitFor(() => expect(result.current.status).toBe("loaded"));

    await act(async () => {
      await result.current.revoke("c1");
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [revokeUrl, revokeInit] = fetchMock.mock.calls[1];
    expect(revokeUrl).toBe("/api/admin-panel/collaborators/c1");
    expect(revokeInit).toMatchObject({ method: "DELETE" });
    expect(result.current.collaborators).toEqual([]);
  });

  it("un error de revoke se propaga (no queda atrapado en el hook)", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        mockResponse({ ok: true, status: 200, body: { collaborators: [SAMPLE_COLLABORATOR] } }),
      )
      .mockResolvedValueOnce(
        mockResponse({ ok: false, status: 403, body: { error: "No tenés permiso." } }),
      );
    global.fetch = fetchMock;

    const { result } = renderHook(() => useTeam());
    await waitFor(() => expect(result.current.status).toBe("loaded"));

    await expect(result.current.revoke("c1")).rejects.toThrow();
  });
});
