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
  fireEvent.change(screen.getByRole("combobox", { name: "Ciudad" }), { target: { value: "Yerba Buena" } });
}

// KAN-297: el listado de ciudades ahora se pide lazy (recién al primer foco del campo "Ciudad"),
// no al montar el formulario — este helper simula esa interacción y espera a que el fetch
// encolado por el test resuelva antes de seguir.
async function openCityField() {
  fireEvent.focus(screen.getByRole("combobox", { name: "Ciudad" }));
  await waitFor(() =>
    expect(screen.queryByText(/cargando ciudades/i)).not.toBeInTheDocument(),
  );
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

    renderGate();

    await waitFor(() => expect(screen.getByText(/completá tu perfil/i)).toBeInTheDocument());
    expect(screen.queryByText("Dashboard real")).not.toBeInTheDocument();
  });

  it("guardar el formulario con éxito desbloquea el dashboard", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    fetchMock.mockResolvedValueOnce(AUTHENTICATED_SESSION);
    fetchMock.mockResolvedValueOnce(profileResponse(false));

    renderGate();
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Ciudad" })).toBeEnabled());

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

    renderGate();
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Ciudad" })).toBeEnabled());

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

    renderGate();
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Ciudad" })).toBeEnabled());

    // KAN-297: la carga es lazy — el error de /api/localities/tucuman recién aparece cuando el
    // agente hace foco en "Ciudad", no al montar el formulario.
    fetchMock.mockResolvedValueOnce(
      mockResponse({ ok: false, status: 500, body: JSON.stringify({ error: "Error interno." }) }),
    );
    fireEvent.focus(screen.getByRole("combobox", { name: "Ciudad" }));

    await waitFor(() => expect(screen.getByText("Error interno.")).toBeInTheDocument());
    expect(screen.getByLabelText("Nombre")).toBeInTheDocument();

    // El error de localidades no bloquea completar el resto del form con texto libre (AC).
    fillForm();
    expect(screen.getByRole("combobox", { name: "Ciudad" })).toHaveValue("Yerba Buena");
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

  it("el campo Ciudad carga lazy, filtra por texto y permite elegir una opción de la lista", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    fetchMock.mockResolvedValueOnce(AUTHENTICATED_SESSION);
    fetchMock.mockResolvedValueOnce(profileResponse(false));

    renderGate();
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Ciudad" })).toBeEnabled());
    // Antes de tocar el campo, /api/localities/tucuman todavía no se pidió (lazy loading, AC).
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fetchMock.mockResolvedValueOnce(
      localitiesResponse(["San Miguel de Tucumán", "Yerba Buena", "Tafí Viejo"]),
    );
    await openCityField();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(screen.getByRole("option", { name: "San Miguel de Tucumán" })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Ciudad" }), { target: { value: "taf" } });
    await waitFor(() =>
      expect(screen.queryByRole("option", { name: "San Miguel de Tucumán" })).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("option", { name: "Tafí Viejo" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tafí Viejo" }));
    expect(screen.getByRole("combobox", { name: "Ciudad" })).toHaveValue("Tafí Viejo");

    // Un segundo foco no vuelve a pedir el listado (se pide una sola vez).
    fireEvent.focus(screen.getByRole("combobox", { name: "Ciudad" }));
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("permite guardar una ciudad escrita a mano que no figura en la lista sugerida", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    fetchMock.mockResolvedValueOnce(AUTHENTICATED_SESSION);
    fetchMock.mockResolvedValueOnce(profileResponse(false));

    renderGate();
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Ciudad" })).toBeEnabled());

    fetchMock.mockResolvedValueOnce(localitiesResponse(["Yerba Buena"]));
    await openCityField();

    fireEvent.change(screen.getByRole("combobox", { name: "Ciudad" }), { target: { value: "Villa Nougués" } });
    await waitFor(() =>
      expect(screen.getByText(/sin coincidencias/i)).toBeInTheDocument(),
    );

    fillForm();
    fireEvent.change(screen.getByRole("combobox", { name: "Ciudad" }), { target: { value: "Villa Nougués" } });
    expect(screen.getByRole("combobox", { name: "Ciudad" })).toHaveValue("Villa Nougués");

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
});
