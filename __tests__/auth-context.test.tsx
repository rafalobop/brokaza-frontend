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

describe("AuthProvider — logout y expiración de sesión (KAN-168)", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const AUTHENTICATED_SESSION = () =>
    mockResponse({
      ok: true,
      status: 200,
      body: JSON.stringify({
        authenticated: true,
        tenant: { id: "t1", email: "agente@brokaza.com" },
      }),
    });

  it("logout() exitoso deja sessionMessage con el mensaje de cierre de sesión", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    fetchMock.mockResolvedValueOnce(AUTHENTICATED_SESSION());

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("authenticated"));

    fetchMock.mockResolvedValueOnce(mockResponse({ ok: true, status: 200, body: "null" }));

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.status).toBe("unauthenticated");
    expect(result.current.sessionMessage).toBe("Cerraste sesión correctamente.");
    expect(result.current.loggingOut).toBe(false);
  });

  it("logout() tolera una respuesta 204 No Content sin body (contrato futuro de /api/auth/logout)", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    fetchMock.mockResolvedValueOnce(AUTHENTICATED_SESSION());

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("authenticated"));

    // 204 No Content: sin body. `apiClient` ya lo tolera (text() vacío -> body
    // null) sin que este contrato futuro del backend rompa nada del lado del
    // cliente.
    fetchMock.mockResolvedValueOnce(mockResponse({ ok: true, status: 204, body: "" }));

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.status).toBe("unauthenticated");
    expect(result.current.sessionMessage).toBe("Cerraste sesión correctamente.");
  });

  it("dos invocaciones concurrentes de logout() no duplican la llamada de red (AC de sesiones concurrentes)", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    fetchMock.mockResolvedValueOnce(AUTHENTICATED_SESSION());

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("authenticated"));

    let resolveLogout: (() => void) | undefined;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveLogout = () => resolve(mockResponse({ ok: true, status: 200, body: "null" }));
        }),
    );

    let firstCall!: Promise<void>;
    let secondCall!: Promise<void>;
    act(() => {
      firstCall = result.current.logout();
      secondCall = result.current.logout();
    });

    await waitFor(() => expect(result.current.loggingOut).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(2); // bootstrap (session) + 1 sola llamada a logout
    expect(fetchMock.mock.calls[1][0]).toBe("/api/auth/logout");

    await act(async () => {
      resolveLogout?.();
      await Promise.all([firstCall, secondCall]);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.current.status).toBe("unauthenticated");
  });

  it("una expiración de sesión (401) en medio de una sesión activa deja sessionMessage con el mensaje de expirado", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    fetchMock.mockResolvedValueOnce(AUTHENTICATED_SESSION());

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("authenticated"));

    fetchMock.mockResolvedValueOnce(
      mockResponse({ ok: false, status: 401, body: JSON.stringify({ error: "No autenticado." }) }),
    );

    await act(async () => {
      await expect(apiClient("/api/matches")).rejects.toMatchObject({ status: 401 });
    });

    await waitFor(() => expect(result.current.status).toBe("unauthenticated"));
    expect(result.current.sessionMessage).toBe("Tu sesión expiró. Volvé a ingresar.");
  });

  it("un 401 tardío que llega después de un logout manual no pisa el mensaje de éxito ya mostrado", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    fetchMock.mockResolvedValueOnce(AUTHENTICATED_SESSION());

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("authenticated"));

    fetchMock.mockResolvedValueOnce(mockResponse({ ok: true, status: 200, body: "null" }));
    await act(async () => {
      await result.current.logout();
    });
    expect(result.current.sessionMessage).toBe("Cerraste sesión correctamente.");

    // Un request que ya estaba en vuelo antes del logout (ej. un polling)
    // resuelve recién ahora con 401 — el usuario ya no está "authenticated"
    // en ese momento, así que no debe convertirse el mensaje de éxito en uno
    // de expiración.
    fetchMock.mockResolvedValueOnce(
      mockResponse({ ok: false, status: 401, body: JSON.stringify({ error: "No autenticado." }) }),
    );
    await act(async () => {
      await expect(apiClient("/api/matches")).rejects.toMatchObject({ status: 401 });
    });

    expect(result.current.sessionMessage).toBe("Cerraste sesión correctamente.");
  });
});
