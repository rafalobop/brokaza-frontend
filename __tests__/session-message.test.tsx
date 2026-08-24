import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { LoginForm } from "@/components/auth/LoginForm";
import { apiClient } from "@/lib/api-client";

/**
 * Harness mínimo que replica el switch de `status` de `app/page.tsx` (sin
 * `ProfileGate`, fuera de alcance de KAN-168) para probar de punta a punta
 * que, tras un logout o una expiración de sesión, el usuario efectivamente
 * ve `LoginForm` (AC "redirigido a la página de login") con el mensaje
 * correspondiente (AC "mensaje de éxito" / expiración).
 */
function Harness() {
  const { status, tenant, logout, loggingOut } = useAuth();

  if (status === "loading") return <p>Cargando...</p>;
  if (status === "unauthenticated") return <LoginForm />;

  return (
    <div>
      <p>Sesión iniciada como {tenant?.email}</p>
      <button type="button" onClick={() => void logout()} disabled={loggingOut}>
        {loggingOut ? "Cerrando sesión..." : "Cerrar sesión"}
      </button>
    </div>
  );
}

function mockResponse(init: { ok: boolean; status: number; body?: string }): Response {
  return {
    ok: init.ok,
    status: init.status,
    text: async () => init.body ?? "",
  } as Response;
}

const AUTHENTICATED_SESSION = () =>
  mockResponse({
    ok: true,
    status: 200,
    body: JSON.stringify({
      authenticated: true,
      tenant: { id: "t1", email: "agente@brokaza.com" },
    }),
  });

function renderHarness() {
  return render(
    <AuthProvider>
      <Harness />
    </AuthProvider>,
  );
}

describe("Mensaje de sesión en el login tras logout/expiración (KAN-168)", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("logout exitoso redirige al login y muestra el mensaje de éxito", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    fetchMock.mockResolvedValueOnce(AUTHENTICATED_SESSION());

    renderHarness();
    await screen.findByText("Sesión iniciada como agente@brokaza.com");

    fetchMock.mockResolvedValueOnce(mockResponse({ ok: true, status: 200, body: "null" }));
    fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    await waitFor(() => expect(screen.getByText("Ingresá a Brokaza")).toBeInTheDocument());
    expect(screen.getByText("Cerraste sesión correctamente.")).toBeInTheDocument();
  });

  it("una expiración de sesión en medio del uso redirige al login con el mensaje de expirado", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    fetchMock.mockResolvedValueOnce(AUTHENTICATED_SESSION());

    renderHarness();
    await screen.findByText("Sesión iniciada como agente@brokaza.com");

    // Cualquier llamada de la app (no un logout manual) vuelve con 401
    // porque la sesión expiró server-side.
    fetchMock.mockResolvedValueOnce(
      mockResponse({ ok: false, status: 401, body: JSON.stringify({ error: "No autenticado." }) }),
    );
    await expect(apiClient("/api/matches")).rejects.toMatchObject({ status: 401 });

    await waitFor(() => expect(screen.getByText("Ingresá a Brokaza")).toBeInTheDocument());
    expect(screen.getByText("Tu sesión expiró. Volvé a ingresar.")).toBeInTheDocument();
  });

  it("el mensaje de sesión se limpia al reintentar el login", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    fetchMock.mockResolvedValueOnce(AUTHENTICATED_SESSION());

    renderHarness();
    await screen.findByText("Sesión iniciada como agente@brokaza.com");

    fetchMock.mockResolvedValueOnce(mockResponse({ ok: true, status: 200, body: "null" }));
    fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));
    await screen.findByText("Cerraste sesión correctamente.");

    fetchMock.mockResolvedValueOnce(mockResponse({ ok: true, status: 200, body: "null" }));
    fireEvent.change(screen.getByPlaceholderText("vos@inmobiliaria.com"), {
      target: { value: "agente@brokaza.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar Magic Link" }));

    await screen.findByText("Revisá tu email");
    expect(screen.queryByText("Cerraste sesión correctamente.")).not.toBeInTheDocument();
  });

  it("el botón de cerrar sesión se deshabilita mientras la llamada de red está en curso", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    fetchMock.mockResolvedValueOnce(AUTHENTICATED_SESSION());

    renderHarness();
    await screen.findByText("Sesión iniciada como agente@brokaza.com");

    let resolveLogout: (() => void) | undefined;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveLogout = () => resolve(mockResponse({ ok: true, status: 200, body: "null" }));
        }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Cerrar sesión" }));

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Cerrando sesión..." })).toBeDisabled(),
    );

    resolveLogout?.();
    await waitFor(() => expect(screen.getByText("Ingresá a Brokaza")).toBeInTheDocument());
  });
});
