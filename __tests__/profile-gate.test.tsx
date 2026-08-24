import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AuthProvider } from "@/lib/auth-context";
import { ProfileProvider } from "@/lib/profile-context";
import { ProfileGate } from "@/components/profile/ProfileGate";

function mockResponse(init: { ok: boolean; status: number; body?: string }): Response {
  return {
    ok: init.ok,
    status: init.status,
    text: async () => init.body ?? "",
  } as Response;
}

const AUTHENTICATED_SESSION = mockResponse({
  ok: true,
  status: 200,
  body: JSON.stringify({ authenticated: true, tenant: { id: "t1", email: "agente@brokaza.com" } }),
});

function profileBody(profileCompleted: boolean) {
  return {
    id: "t1",
    full_name: profileCompleted ? "Juan Pérez" : "",
    email: "agente@brokaza.com",
    phone_number: profileCompleted ? "+5493815551234" : null,
    agency_name: profileCompleted ? "Inmobiliaria Sur" : null,
    city: profileCompleted ? "San Miguel de Tucumán" : null,
    country: profileCompleted ? "Argentina" : null,
    profile_completed: profileCompleted,
    created_at: "2026-08-01T00:00:00.000Z",
  };
}

function profileResponse(profileCompleted: boolean): Response {
  return mockResponse({
    ok: true,
    status: 200,
    body: JSON.stringify({ profile: profileBody(profileCompleted) }),
  });
}

function localitiesResponse(localities: string[]): Response {
  return mockResponse({ ok: true, status: 200, body: JSON.stringify({ localities }) });
}

function renderGate() {
  return render(
    <AuthProvider>
      <ProfileProvider>
        <ProfileGate>
          <p>Dashboard real</p>
        </ProfileGate>
      </ProfileProvider>
    </AuthProvider>,
  );
}

function fillForm() {
  fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Juan" } });
  fireEvent.change(screen.getByLabelText("Apellido"), { target: { value: "Pérez" } });
  fireEvent.change(screen.getByLabelText("Teléfono"), { target: { value: "+5493815551234" } });
  fireEvent.change(screen.getByLabelText("Inmobiliaria"), {
    target: { value: "Inmobiliaria Sur" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Ciudad" }));
  fireEvent.click(screen.getByRole("button", { name: "Yerba Buena" }));
}

describe("ProfileGate (KAN-167)", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("muestra el estado de carga mientras valida el perfil", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    fetchMock.mockResolvedValueOnce(AUTHENTICATED_SESSION);
    fetchMock.mockResolvedValueOnce(profileResponse(true));

    renderGate();

    expect(screen.getByText(/verificando tu perfil/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Dashboard real")).toBeInTheDocument());
  });

  it("perfil incompleto: bloquea el dashboard y muestra el formulario de completar perfil", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    fetchMock.mockResolvedValueOnce(AUTHENTICATED_SESSION);
    fetchMock.mockResolvedValueOnce(profileResponse(false));
    fetchMock.mockResolvedValueOnce(localitiesResponse(["San Miguel de Tucumán", "Yerba Buena"]));

    renderGate();

    await waitFor(() => expect(screen.getByText(/completá tu perfil/i)).toBeInTheDocument());
    expect(screen.queryByText("Dashboard real")).not.toBeInTheDocument();
  });

  it("guardar el formulario con éxito desbloquea el dashboard", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    fetchMock.mockResolvedValueOnce(AUTHENTICATED_SESSION);
    fetchMock.mockResolvedValueOnce(profileResponse(false));
    fetchMock.mockResolvedValueOnce(localitiesResponse(["Yerba Buena"]));

    renderGate();
    await waitFor(() => expect(screen.getByRole("button", { name: "Ciudad" })).toBeEnabled());

    fillForm();

    fetchMock.mockResolvedValueOnce(
      mockResponse({
        ok: true,
        status: 200,
        body: JSON.stringify({ success: true, profile: profileBody(true) }),
      }),
    );
    fetchMock.mockResolvedValueOnce(profileResponse(true));

    fireEvent.click(screen.getByRole("button", { name: /guardar y continuar/i }));

    await waitFor(() => expect(screen.getByText("Dashboard real")).toBeInTheDocument());
  });

  it("un error del backend al guardar se muestra sin romper el formulario", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    fetchMock.mockResolvedValueOnce(AUTHENTICATED_SESSION);
    fetchMock.mockResolvedValueOnce(profileResponse(false));
    fetchMock.mockResolvedValueOnce(localitiesResponse(["Yerba Buena"]));

    renderGate();
    await waitFor(() => expect(screen.getByRole("button", { name: "Ciudad" })).toBeEnabled());

    fillForm();

    fetchMock.mockResolvedValueOnce(
      mockResponse({
        ok: false,
        status: 400,
        body: JSON.stringify({ error: "Teléfono inválido." }),
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: /guardar y continuar/i }));

    await waitFor(() => expect(screen.getByText("Teléfono inválido.")).toBeInTheDocument());
    expect(screen.queryByText("Dashboard real")).not.toBeInTheDocument();
  });

  it("un error al cargar las localidades se muestra sin bloquear el resto del formulario", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    fetchMock.mockResolvedValueOnce(AUTHENTICATED_SESSION);
    fetchMock.mockResolvedValueOnce(profileResponse(false));
    fetchMock.mockResolvedValueOnce(
      mockResponse({ ok: false, status: 500, body: JSON.stringify({ error: "Error interno." }) }),
    );

    renderGate();

    await waitFor(() => expect(screen.getByText("Error interno.")).toBeInTheDocument());
    expect(screen.getByLabelText("Nombre")).toBeInTheDocument();
  });

  it("el reintento tras un error de /api/profile vuelve a consultar y desbloquea el dashboard", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    fetchMock.mockResolvedValueOnce(AUTHENTICATED_SESSION);
    fetchMock.mockResolvedValueOnce(
      mockResponse({ ok: false, status: 500, body: JSON.stringify({ error: "Error interno." }) }),
    );

    renderGate();
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /reintentar/i })).toBeInTheDocument(),
    );

    fetchMock.mockResolvedValueOnce(profileResponse(true));
    fireEvent.click(screen.getByRole("button", { name: /reintentar/i }));

    await waitFor(() => expect(screen.getByText("Dashboard real")).toBeInTheDocument());
  });
});
