import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { AuthProvider } from "@/lib/auth-context";
import { ProfileProvider, useProfile } from "@/lib/profile-context";

function mockResponse(init: { ok: boolean; status: number; body?: string }): Response {
  return {
    ok: init.ok,
    status: init.status,
    text: async () => init.body ?? "",
  } as Response;
}

function wrapper({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ProfileProvider>{children}</ProfileProvider>
    </AuthProvider>
  );
}

const AUTHENTICATED_SESSION = mockResponse({
  ok: true,
  status: 200,
  body: JSON.stringify({ authenticated: true, tenant: { id: "t1", email: "agente@brokaza.com" } }),
});

const UNAUTHENTICATED_SESSION = mockResponse({
  ok: true,
  status: 200,
  body: JSON.stringify({ authenticated: false }),
});

function profileResponse(profileCompleted: boolean): Response {
  return mockResponse({
    ok: true,
    status: 200,
    body: JSON.stringify({
      profile: {
        id: "t1",
        full_name: profileCompleted ? "Juan Pérez" : "",
        email: "agente@brokaza.com",
        phone_number: profileCompleted ? "+5493815551234" : null,
        agency_name: profileCompleted ? "Inmobiliaria Sur" : null,
        city: profileCompleted ? "San Miguel de Tucumán" : null,
        country: profileCompleted ? "Argentina" : null,
        profile_completed: profileCompleted,
        created_at: "2026-08-01T00:00:00.000Z",
      },
    }),
  });
}

describe("ProfileProvider / useProfile (KAN-167)", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("con sesión autenticada y perfil incompleto, status termina en 'incomplete'", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    fetchMock.mockResolvedValueOnce(AUTHENTICATED_SESSION);
    fetchMock.mockResolvedValueOnce(profileResponse(false));

    const { result } = renderHook(() => useProfile(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("incomplete"));
    expect(result.current.profile?.profile_completed).toBe(false);
  });

  it("con sesión autenticada y perfil completo, status termina en 'complete'", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    fetchMock.mockResolvedValueOnce(AUTHENTICATED_SESSION);
    fetchMock.mockResolvedValueOnce(profileResponse(true));

    const { result } = renderHook(() => useProfile(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("complete"));
    expect(result.current.profile?.profile_completed).toBe(true);
  });

  it("sin sesión, nunca consulta /api/profile y el status queda en 'idle'", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    fetchMock.mockResolvedValue(UNAUTHENTICATED_SESSION);

    const { result } = renderHook(() => useProfile(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("idle"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/auth/session");
  });

  it("un error al consultar /api/profile deja status 'error' sin romper la UI", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    fetchMock.mockResolvedValueOnce(AUTHENTICATED_SESSION);
    fetchMock.mockResolvedValueOnce(
      mockResponse({ ok: false, status: 500, body: JSON.stringify({ error: "Error interno." }) }),
    );

    const { result } = renderHook(() => useProfile(), { wrapper });

    await waitFor(() => expect(result.current.status).toBe("error"));
    expect(result.current.error).toBe("Error interno.");
  });

  it("refresh() vuelve a consultar /api/profile y actualiza el status", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    fetchMock.mockResolvedValueOnce(AUTHENTICATED_SESSION);
    fetchMock.mockResolvedValueOnce(profileResponse(false));

    const { result } = renderHook(() => useProfile(), { wrapper });
    await waitFor(() => expect(result.current.status).toBe("incomplete"));

    fetchMock.mockResolvedValueOnce(profileResponse(true));
    await result.current.refresh();

    await waitFor(() => expect(result.current.status).toBe("complete"));
  });
});
