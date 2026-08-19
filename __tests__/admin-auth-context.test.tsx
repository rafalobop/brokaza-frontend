import { act, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { AdminAuthProvider, useAdminAuth } from "@/lib/admin-auth-context";
import { apiClient } from "@/lib/api-client";

function mockResponse(init: { ok: boolean; status: number; body?: string }): Response {
  return {
    ok: init.ok,
    status: init.status,
    text: async () => init.body ?? "",
  } as Response;
}

function wrapper({ children }: { children: ReactNode }) {
  return <AdminAuthProvider>{children}</AdminAuthProvider>;
}

const AUTHENTICATED_SESSION = () =>
  mockResponse({
    ok: true,
    status: 200,
    body: JSON.stringify({ authenticated: true, admin: { email: "admin@brokaza.com" } }),
  });

describe("AdminAuthProvider / useAdminAuth (KAN-239)", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("bootstrap: sesión válida -> status 'authenticated', pega a /admin/api/auth/session", async () => {
    const fetchMock = jest.fn().mockResolvedValue(AUTHENTICATED_SESSION());
    global.fetch = fetchMock;

    const { result } = renderHook(() => useAdminAuth(), { wrapper });

    expect(result.current.status).toBe("loading");

    await waitFor(() => expect(result.current.status).toBe("authenticated"));
    expect(result.current.admin).toEqual({ email: "admin@brokaza.com" });
    expect(fetchMock).toHaveBeenCalledWith(
      "/admin/api/auth/session",
      expect.objectContaining({}),
    );
  });

  it("bootstrap: sin sesión -> status 'unauthenticated'", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        mockResponse({ ok: true, status: 200, body: JSON.stringify({ authenticated: false }) }),
      );

    const { result } = renderHook(() => useAdminAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("unauthenticated"));
    expect(result.current.admin).toBeNull();
  });

  it("un 401 en medio de una sesión activa desloguea (mismo interceptor global que tenant)", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    fetchMock.mockResolvedValueOnce(AUTHENTICATED_SESSION());

    const { result } = renderHook(() => useAdminAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("authenticated"));

    fetchMock.mockResolvedValueOnce(
      mockResponse({ ok: false, status: 401, body: JSON.stringify({ error: "No autenticado." }) }),
    );
    await act(async () => {
      await expect(apiClient("/admin/api/properties")).rejects.toMatchObject({ status: 401 });
    });

    await waitFor(() => expect(result.current.status).toBe("unauthenticated"));
    expect(result.current.sessionMessage).toBe("Tu sesión expiró. Volvé a ingresar.");
  });

  it("logout() limpia el estado local aunque la llamada de red falle", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    fetchMock.mockResolvedValueOnce(AUTHENTICATED_SESSION());

    const { result } = renderHook(() => useAdminAuth(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("authenticated"));

    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    await act(async () => {
      await result.current.logout();
    });

    expect(result.current.status).toBe("unauthenticated");
    expect(result.current.admin).toBeNull();
    expect(result.current.sessionMessage).toBe("Cerraste sesión correctamente.");
  });

  it("dos invocaciones concurrentes de logout() no duplican la llamada de red", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    fetchMock.mockResolvedValueOnce(AUTHENTICATED_SESSION());

    const { result } = renderHook(() => useAdminAuth(), { wrapper });
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
    expect(fetchMock).toHaveBeenCalledTimes(2); // bootstrap + 1 sola llamada a logout
    expect(fetchMock.mock.calls[1][0]).toBe("/admin/api/auth/logout");

    await act(async () => {
      resolveLogout?.();
      await Promise.all([firstCall, secondCall]);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("useAdminAuth fuera de <AdminAuthProvider> tira un error explícito", () => {
    const consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});

    expect(() => renderHook(() => useAdminAuth())).toThrow(
      "useAdminAuth debe usarse dentro de <AdminAuthProvider>",
    );

    consoleErrorSpy.mockRestore();
  });
});

describe("AdminAuthProvider — callback de magic-link reusa consumeAuthCallbackHash (KAN-239)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = originalFetch;
    window.location.hash = "";
    jest.restoreAllMocks();
  });

  it("hash con access_token intercambia el token contra /admin/api/auth/exchange-token", async () => {
    window.location.hash = "#access_token=fake-admin-token&token_type=bearer";

    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    fetchMock.mockResolvedValueOnce(mockResponse({ ok: true, status: 200, body: "null" }));
    fetchMock.mockResolvedValueOnce(AUTHENTICATED_SESSION());

    const { result } = renderHook(() => useAdminAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("authenticated"));
    expect(window.location.hash).toBe("");
    expect(fetchMock.mock.calls[0][0]).toBe("/admin/api/auth/exchange-token");
    expect(fetchMock.mock.calls[1][0]).toBe("/admin/api/auth/session");
  });

  it("hash con error=otp_expired expone el mensaje de vencido (mismo texto que el tenant)", async () => {
    window.location.hash =
      "#error=access_denied&error_code=otp_expired&error_description=Link+expired";

    global.fetch = jest
      .fn()
      .mockResolvedValue(
        mockResponse({ ok: true, status: 200, body: JSON.stringify({ authenticated: false }) }),
      );

    const { result } = renderHook(() => useAdminAuth(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("unauthenticated"));
    expect(result.current.authError).toBe(
      "Tu link de acceso expiró o ya fue usado. Ingresá tu email para solicitar uno nuevo.",
    );
  });
});
