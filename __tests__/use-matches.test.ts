import { act, renderHook, waitFor } from "@testing-library/react";
import { useMatches } from "@/lib/use-matches";

function mockResponse(init: { ok: boolean; status: number; body?: unknown }): Response {
  return {
    ok: init.ok,
    status: init.status,
    text: async () => (init.body !== undefined ? JSON.stringify(init.body) : ""),
  } as Response;
}

const SAMPLE_MATCH = {
  id: "m1",
  fecha: "2026-01-01",
  searchText: "depto 2 dorm",
  property: { domicilio: "Calle Falsa 123", precio: 1000, moneda: "USD", operacion: "alquiler" },
  reasons: [],
  score: 80,
  userReviewStatus: "PENDING",
  feedbackReason: null,
};

describe("useMatches (KAN-189)", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("carga los matches al montar (GET /api/matches)", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(mockResponse({ ok: true, status: 200, body: { matches: [SAMPLE_MATCH] } }));

    const { result } = renderHook(() => useMatches());

    await waitFor(() => expect(result.current.status).toBe("loaded"));
    expect(result.current.matches).toEqual([SAMPLE_MATCH]);
    expect(global.fetch).toHaveBeenCalledWith("/api/matches", expect.objectContaining({}));
  });

  it("pasa a status=error si GET /api/matches falla", async () => {
    global.fetch = jest.fn().mockResolvedValue(mockResponse({ ok: false, status: 500, body: {} }));

    const { result } = renderHook(() => useMatches());

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBeTruthy();
  });

  it("sendFeedback llama a POST /api/matches/:id/feedback y refetchea", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        mockResponse({ ok: true, status: 200, body: { matches: [SAMPLE_MATCH] } }),
      )
      .mockResolvedValueOnce(mockResponse({ ok: true, status: 200, body: { success: true } }))
      .mockResolvedValueOnce(
        mockResponse({
          ok: true,
          status: 200,
          body: { matches: [{ ...SAMPLE_MATCH, userReviewStatus: "ACCEPTED" }] },
        }),
      );
    global.fetch = fetchMock;

    const { result } = renderHook(() => useMatches());
    await waitFor(() => expect(result.current.status).toBe("loaded"));

    await act(async () => {
      await result.current.sendFeedback("m1", "ACCEPTED");
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [feedbackUrl, feedbackInit] = fetchMock.mock.calls[1];
    expect(feedbackUrl).toBe("/api/matches/m1/feedback");
    expect(feedbackInit).toMatchObject({ method: "POST" });
    expect(JSON.parse(feedbackInit.body)).toEqual({ status: "ACCEPTED", reason: null });
    expect(result.current.matches[0].userReviewStatus).toBe("ACCEPTED");
  });

  it("sendFeedback con motivo de rechazo manda el reason en el body", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(mockResponse({ ok: true, status: 200, body: { matches: [] } }))
      .mockResolvedValueOnce(mockResponse({ ok: true, status: 200, body: { success: true } }))
      .mockResolvedValueOnce(mockResponse({ ok: true, status: 200, body: { matches: [] } }));
    global.fetch = fetchMock;

    const { result } = renderHook(() => useMatches());
    await waitFor(() => expect(result.current.status).toBe("loaded"));

    await act(async () => {
      await result.current.sendFeedback("m1", "REJECTED", "Zona errónea o incorrecta");
    });

    const [, feedbackInit] = fetchMock.mock.calls[1];
    expect(JSON.parse(feedbackInit.body)).toEqual({
      status: "REJECTED",
      reason: "Zona errónea o incorrecta",
    });
  });
});
