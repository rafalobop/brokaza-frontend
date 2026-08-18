import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { apiClient } from "@/lib/api-client";

function mockResponse(init: { ok: boolean; status: number; body?: string }): Response {
  return {
    ok: init.ok,
    status: init.status,
    text: async () => init.body ?? "",
  } as Response;
}

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe("AuthProvider / useAuth (KAN-160/KAN-163)", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("bootstrap: sesión válida -> status 'authenticated'", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockResponse({
        ok: true,
        status: 200,
        body: JSON.stringify({
          authenticated: true,
          tenant: { id: "t1", email: "agente@brokaza.com" },
        }),
      }),
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.status).toBe("loading");

    await waitFor(() => expect(result.current.status).toBe("authenticated"));
    expect(result.current.tenant).toEqual({ id: "t1", email: "agente@brokaza.com" });
  });

  it("bootstrap: sin sesión -> status 'unauthenticated'", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        mockResponse({ ok: true, status: 200, body: JSON.stringify({ authenticated: false }) }),
      );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("unauthenticated"));
    expect(result.current.tenant).toBeNull();
  });

  it("KAN-163: una llamada que devuelve 401 en medio de una sesión activa desloguea sin recargar la página", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;

    // 1. Bootstrap: sesión válida.
    fetchMock.mockResolvedValueOnce(
      mockResponse({
        ok: true,
        status: 200,
        body: JSON.stringify({
          authenticated: true,
          tenant: { id: "t1", email: "agente@brokaza.com" },
        }),
      }),
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("authenticated"));

    // 2. Cualquier otra llamada de la app (ej. /api/matches) vuelve con 401
    //    porque la sesión expiró server-side — pasa por el MISMO apiClient
    //    real que usa el resto de la app, no un mock del interceptor.
    fetchMock.mockResolvedValueOnce(
      mockResponse({ ok: false, status: 401, body: JSON.stringify({ error: "No autenticado." }) }),
    );

    await act(async () => {
      await expect(apiClient("/api/matches")).rejects.toMatchObject({ status: 401 });
    });

    await waitFor(() => expect(result.current.status).toBe("unauthenticated"));
    expect(result.current.tenant).toBeNull();
  });

  it("logout() limpia el estado local aunque la llamada de red falle", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;

    fetchMock.mockResolvedValueOnce(
      mockResponse({
        ok: true,
        status: 200,
        body: JSON.stringify({
          authenticated: true,
          tenant: { id: "t1", email: "agente@brokaza.com" },
        }),
      }),
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("authenticated"));

    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.status).toBe("unauthenticated");
    expect(result.current.tenant).toBeNull();
  });

  it("useAuth fuera de <AuthProvider> tira un error explícito", () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    expect(() => renderHook(() => useAuth())).toThrow(
      "useAuth debe usarse dentro de <AuthProvider>",
    );

    consoleErrorSpy.mockRestore();
  });
});

describe("AuthProvider — callback de magic-link (KAN-166)", () => {
  const originalFetch = global.fetch;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = originalFetch;
    window.location.hash = "";
    jest.restoreAllMocks();
  });

  it("hash con access_token intercambia el token y termina 'authenticated'", async () => {
    window.location.hash = "#access_token=fake-token&token_type=bearer";

    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    // 1. POST /api/auth/exchange-token
    fetchMock.mockResolvedValueOnce(mockResponse({ ok: true, status: 200, body: "null" }));
    // 2. GET /api/auth/session (refresh() posterior)
    fetchMock.mockResolvedValueOnce(
      mockResponse({
        ok: true,
        status: 200,
        body: JSON.stringify({
          authenticated: true,
          tenant: { id: "t1", email: "agente@brokaza.com" },
        }),
      }),
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("authenticated"));
    expect(window.location.hash).toBe("");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/exchange-token");
    expect(fetchMock.mock.calls[1][0]).toBe("/api/auth/session");
  });

  it("hash con error=otp_expired limpia el hash y expone el mensaje de vencido", async () => {
    window.location.hash = "#error=access_denied&error_code=otp_expired&error_description=Link+expired";

    global.fetch = jest
      .fn()
      .mockResolvedValue(
        mockResponse({ ok: true, status: 200, body: JSON.stringify({ authenticated: false }) }),
      );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("unauthenticated"));
    expect(window.location.hash).toBe("");
    expect(result.current.authError).toBe(
      "Tu link de acceso expiró o ya fue usado. Ingresá tu email para solicitar uno nuevo.",
    );
  });

  it("hash con otro error_code expone el mensaje genérico de link inválido", async () => {
    window.location.hash = "#error=access_denied&error_code=otp_disabled";

    global.fetch = jest
      .fn()
      .mockResolvedValue(
        mockResponse({ ok: true, status: 200, body: JSON.stringify({ authenticated: false }) }),
      );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("unauthenticated"));
    expect(result.current.authError).toBe(
      "El link de acceso no es válido. Ingresá tu email para solicitar uno nuevo.",
    );
  });

  it("fallo al intercambiar el token deja authError seteado con el mensaje real", async () => {
    window.location.hash = "#access_token=fake-token";

    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    fetchMock.mockResolvedValueOnce(
      mockResponse({
        ok: false,
        status: 400,
        body: JSON.stringify({ error: "Token inválido o vencido." }),
      }),
    );
    fetchMock.mockResolvedValueOnce(
      mockResponse({ ok: true, status: 200, body: JSON.stringify({ authenticated: false }) }),
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("unauthenticated"));
    expect(result.current.authError).toBe("Token inválido o vencido.");
    expect(consoleSpy).toBeDefined();
  });

  it("clearAuthError limpia el mensaje", async () => {
    window.location.hash = "#error=access_denied&error_code=otp_expired";
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        mockResponse({ ok: true, status: 200, body: JSON.stringify({ authenticated: false }) }),
      );

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.authError).not.toBeNull());

    act(() => result.current.clearAuthError());

    expect(result.current.authError).toBeNull();
  });
});
