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

function profileBody(
  profileCompleted: boolean,
  overrides: {
    license_validation_status?: "validated" | "pending" | "rejected";
    license_number?: string | null;
    role?: "owner" | "collaborator";
    agency_name?: string | null;
  } = {},
) {
  return {
    id: "t1",
    full_name: profileCompleted ? "Juan Pérez" : "",
    email: "agente@brokaza.com",
    phone_number: profileCompleted ? "+5493815551234" : null,
    agency_name:
      overrides.agency_name !== undefined
        ? overrides.agency_name
        : profileCompleted
          ? "Inmobiliaria Sur"
          : null,
    city: profileCompleted ? "San Miguel de Tucumán" : null,
    country: profileCompleted ? "Argentina" : null,
    profile_completed: profileCompleted,
    license_number: overrides.license_number ?? (profileCompleted ? "350" : null),
    license_validation_status:
      overrides.license_validation_status ?? (profileCompleted ? "validated" : "rejected"),
    role: overrides.role ?? "owner",
    created_at: "2026-08-01T00:00:00.000Z",
  };
}

function profileResponse(
  profileCompleted: boolean,
  overrides: {
    license_validation_status?: "validated" | "pending" | "rejected";
    license_number?: string | null;
    role?: "owner" | "collaborator";
    agency_name?: string | null;
  } = {},
): Response {
  return mockResponse({
    ok: true,
    status: 200,
    body: JSON.stringify({ profile: profileBody(profileCompleted, overrides) }),
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

// Pase de UI (2026-09-04, punto 8): el formulario pasó a 2 pasos — "Datos personales"
// (Nombre/Apellido/Teléfono) y "Inmobiliaria" (Matrícula/Inmobiliaria/Ciudad). `fillStep1` +
// `goToStep2` reemplazan lo que antes hacía `fillForm` en un solo paso.
function fillStep1(phoneLocalNumber = "38155512") {
  fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Juan" } });
  fireEvent.change(screen.getByLabelText("Apellido"), { target: { value: "Pérez" } });
  // Código de país queda en el default ("+54") — solo se completa el número local.
  fireEvent.change(screen.getByLabelText("Número de teléfono"), {
    target: { value: phoneLocalNumber },
  });
}

async function goToStep2() {
  fireEvent.click(screen.getByRole("button", { name: /siguiente/i }));
  await waitFor(() => expect(screen.getByRole("combobox", { name: "Ciudad" })).toBeEnabled());
}

function fillStep2({
  license = "350",
  agency = "Inmobiliaria Sur",
  city = "Yerba Buena",
  includeLicense = true,
}: { license?: string; agency?: string; city?: string; includeLicense?: boolean } = {}) {
  if (includeLicense) {
    fireEvent.change(screen.getByLabelText("Número de matrícula"), { target: { value: license } });
  }
  fireEvent.change(screen.getByLabelText("Inmobiliaria", { exact: false }), {
    target: { value: agency },
  });
  fireEvent.change(screen.getByRole("combobox", { name: "Ciudad" }), { target: { value: city } });
}

async function fillForm() {
  fillStep1();
  await goToStep2();
  fillStep2();
}

// KAN-297: el listado de ciudades ahora se pide lazy (recién al primer foco del campo "Ciudad"),
// no al montar el formulario — este helper simula esa interacción y espera a que el fetch
// encolado por el test resuelva antes de seguir.
async function openCityField() {
  fireEvent.focus(screen.getByRole("combobox", { name: "Ciudad" }));
  await waitFor(() => expect(screen.queryByText(/cargando ciudades/i)).not.toBeInTheDocument());
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
    await waitFor(() => expect(screen.getByLabelText("Nombre")).toBeEnabled());

    await fillForm();

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
    await waitFor(() => expect(screen.getByLabelText("Nombre")).toBeEnabled());

    await fillForm();

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
    await waitFor(() => expect(screen.getByLabelText("Nombre")).toBeEnabled());
    fillStep1();
    fireEvent.click(screen.getByRole("button", { name: /siguiente/i }));
    await waitFor(() =>
      expect(screen.getByLabelText("Inmobiliaria", { exact: false })).toBeEnabled(),
    );

    // KAN-297: la carga es lazy — el error de /api/localities/tucuman recién aparece cuando el
    // agente hace foco en "Ciudad", no al montar el formulario.
    fetchMock.mockResolvedValueOnce(
      mockResponse({ ok: false, status: 500, body: JSON.stringify({ error: "Error interno." }) }),
    );
    fireEvent.focus(screen.getByRole("combobox", { name: "Ciudad" }));

    await waitFor(() => expect(screen.getByText("Error interno.")).toBeInTheDocument());

    // El error de localidades no bloquea completar el resto del paso con texto libre (AC).
    fillStep2();
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
    await waitFor(() => expect(screen.getByLabelText("Nombre")).toBeEnabled());
    fillStep1();
    fireEvent.click(screen.getByRole("button", { name: /siguiente/i }));
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Ciudad" })).toBeEnabled());
    // Antes de tocar el campo, /api/localities/tucuman todavía no se pidió (lazy loading, AC).
    expect(fetchMock).toHaveBeenCalledTimes(2);

    fetchMock.mockResolvedValueOnce(
      localitiesResponse(["San Miguel de Tucumán", "Yerba Buena", "Tafí Viejo"]),
    );
    await openCityField();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(screen.getByRole("option", { name: "San Miguel de Tucumán" })).toBeInTheDocument();

    fireEvent.change(screen.getByRole("combobox", { name: "Ciudad" }), {
      target: { value: "taf" },
    });
    await waitFor(() =>
      expect(
        screen.queryByRole("option", { name: "San Miguel de Tucumán" }),
      ).not.toBeInTheDocument(),
    );
    expect(screen.getByRole("option", { name: "Tafí Viejo" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Tafí Viejo" }));
    expect(screen.getByRole("combobox", { name: "Ciudad" })).toHaveValue("Tafí Viejo");

    // Un segundo foco no vuelve a pedir el listado (se pide una sola vez).
    fireEvent.focus(screen.getByRole("combobox", { name: "Ciudad" }));
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  // --- KAN-306 ---

  it("guardar con matrícula pendiente de validación muestra la pantalla de espera, no el dashboard", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    fetchMock.mockResolvedValueOnce(AUTHENTICATED_SESSION);
    fetchMock.mockResolvedValueOnce(profileResponse(false));

    renderGate();
    await waitFor(() => expect(screen.getByLabelText("Nombre")).toBeEnabled());

    await fillForm();

    fetchMock.mockResolvedValueOnce(
      mockResponse({
        ok: true,
        status: 200,
        body: JSON.stringify({
          success: true,
          profile: profileBody(false, {
            license_validation_status: "pending",
            license_number: "350",
          }),
        }),
      }),
    );
    fetchMock.mockResolvedValueOnce(
      profileResponse(false, { license_validation_status: "pending", license_number: "350" }),
    );

    fireEvent.click(screen.getByRole("button", { name: /guardar y continuar/i }));

    await waitFor(() =>
      expect(screen.getByText(/tu cuenta está en revisión/i)).toBeInTheDocument(),
    );
    expect(screen.queryByText("Dashboard real")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Nombre")).not.toBeInTheDocument();
  });

  // Fix QA: `license_validation_status` tiene DEFAULT 'pending' en la base — una cuenta recién
  // creada por magic link (nunca completó el formulario, `license_number` todavía null) también
  // trae 'pending' desde el primer `GET /api/profile`. Regresión del bug real encontrado por
  // @qa en navegador: sin este chequeo, `ProfileGate` mostraba la pantalla de espera en vez del
  // formulario de registro, bloqueando el onboarding de cualquier cuenta nueva.
  it("una cuenta nueva (license_number=null, pending por default) ve el formulario de registro, no la pantalla de espera", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    fetchMock.mockResolvedValueOnce(AUTHENTICATED_SESSION);
    fetchMock.mockResolvedValueOnce(
      profileResponse(false, { license_validation_status: "pending", license_number: null }),
    );

    renderGate();

    await waitFor(() => expect(screen.getByText(/completá tu perfil/i)).toBeInTheDocument());
    expect(screen.queryByText(/tu cuenta está en revisión/i)).not.toBeInTheDocument();
  });

  it("una matrícula rechazada (403) muestra el error del backend y deja el formulario para reintentar", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    fetchMock.mockResolvedValueOnce(AUTHENTICATED_SESSION);
    fetchMock.mockResolvedValueOnce(profileResponse(false));

    renderGate();
    await waitFor(() => expect(screen.getByLabelText("Nombre")).toBeEnabled());

    await fillForm();

    fetchMock.mockResolvedValueOnce(
      mockResponse({
        ok: false,
        status: 403,
        body: JSON.stringify({
          error:
            "El número de matrícula ingresado no figura en el padrón de matriculados. Verificalo e intentá de nuevo.",
          license_validation_status: "rejected",
        }),
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: /guardar y continuar/i }));

    await waitFor(() =>
      expect(screen.getByText(/no figura en el padrón de matriculados/i)).toBeInTheDocument(),
    );
    // El formulario sigue en el paso 2, disponible para corregir el número e intentar de nuevo.
    expect(screen.getByLabelText("Número de matrícula")).toHaveValue("350");
  });

  it("la pantalla de espera permite verificar de nuevo y desbloquear el dashboard si ya se validó", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    fetchMock.mockResolvedValueOnce(AUTHENTICATED_SESSION);
    fetchMock.mockResolvedValueOnce(
      profileResponse(false, { license_validation_status: "pending", license_number: "350" }),
    );

    renderGate();
    await waitFor(() =>
      expect(screen.getByText(/tu cuenta está en revisión/i)).toBeInTheDocument(),
    );

    fetchMock.mockResolvedValueOnce(profileResponse(true));
    fireEvent.click(screen.getByRole("button", { name: /verificar de nuevo/i }));

    await waitFor(() => expect(screen.getByText("Dashboard real")).toBeInTheDocument());
  });

  it("permite guardar una ciudad escrita a mano que no figura en la lista sugerida", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    fetchMock.mockResolvedValueOnce(AUTHENTICATED_SESSION);
    fetchMock.mockResolvedValueOnce(profileResponse(false));

    renderGate();
    await waitFor(() => expect(screen.getByLabelText("Nombre")).toBeEnabled());
    fillStep1();
    fireEvent.click(screen.getByRole("button", { name: /siguiente/i }));
    await waitFor(() => expect(screen.getByRole("combobox", { name: "Ciudad" })).toBeEnabled());

    fetchMock.mockResolvedValueOnce(localitiesResponse(["Yerba Buena"]));
    await openCityField();

    fireEvent.change(screen.getByRole("combobox", { name: "Ciudad" }), {
      target: { value: "Villa Nougués" },
    });
    await waitFor(() => expect(screen.getByText(/sin coincidencias/i)).toBeInTheDocument());

    fillStep2({ city: "Villa Nougués" });
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

  // --- KAN-306 (cambio de flujo de colaboradores): el campo de matrícula se oculta para role="collaborator" ---

  it("un colaborador no ve el campo de matrícula en el paso 2 del formulario", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    fetchMock.mockResolvedValueOnce(AUTHENTICATED_SESSION);
    fetchMock.mockResolvedValueOnce(
      profileResponse(false, { role: "collaborator", license_number: null }),
    );

    renderGate();
    await waitFor(() => expect(screen.getByLabelText("Nombre")).toBeEnabled());
    fillStep1();
    await goToStep2();

    expect(screen.queryByLabelText("Número de matrícula")).not.toBeInTheDocument();
  });

  it("un colaborador completa el perfil sin mandar license_number ni agency_name en el body", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    fetchMock.mockResolvedValueOnce(AUTHENTICATED_SESSION);
    fetchMock.mockResolvedValueOnce(
      profileResponse(false, {
        role: "collaborator",
        license_number: null,
        agency_name: "Inmobiliaria del Dueño",
      }),
    );

    renderGate();
    await waitFor(() => expect(screen.getByLabelText("Nombre")).toBeEnabled());
    fillStep1();
    await goToStep2();
    // Inmobiliaria queda bloqueada (ya heredada del dueño) — solo falta Ciudad.
    fireEvent.change(screen.getByRole("combobox", { name: "Ciudad" }), {
      target: { value: "Yerba Buena" },
    });

    fetchMock.mockResolvedValueOnce(
      mockResponse({
        ok: true,
        status: 200,
        body: JSON.stringify({
          success: true,
          profile: profileBody(true, {
            role: "collaborator",
            license_number: null,
            agency_name: "Inmobiliaria del Dueño",
          }),
        }),
      }),
    );
    fetchMock.mockResolvedValueOnce(
      profileResponse(true, {
        role: "collaborator",
        license_number: null,
        agency_name: "Inmobiliaria del Dueño",
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: /guardar y continuar/i }));

    await waitFor(() => expect(screen.getByText("Dashboard real")).toBeInTheDocument());

    const postCall = fetchMock.mock.calls.find(
      ([, init]) => (init as RequestInit)?.method === "POST",
    );
    const sentBody = JSON.parse((postCall![1] as RequestInit).body as string);
    expect(sentBody).not.toHaveProperty("license_number");
    expect(sentBody).not.toHaveProperty("agency_name");
    expect(sentBody).toEqual(
      expect.objectContaining({ phone_country_code: "+54", phone_local_number: "38155512" }),
    );
  });

  // --- Pase de UI (2026-09-04, punto 2): inmobiliaria bloqueada para un invitado ---

  it("un colaborador ve la Inmobiliaria pre-cargada y bloqueada con la del dueño de su agencia", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    fetchMock.mockResolvedValueOnce(AUTHENTICATED_SESSION);
    fetchMock.mockResolvedValueOnce(
      profileResponse(false, {
        role: "collaborator",
        license_number: null,
        agency_name: "Inmobiliaria del Dueño",
      }),
    );

    renderGate();
    await waitFor(() => expect(screen.getByLabelText("Nombre")).toBeEnabled());
    fillStep1();
    await goToStep2();

    const agencyInput = screen.getByLabelText("Inmobiliaria", { exact: false }) as HTMLInputElement;
    expect(agencyInput).toHaveValue("Inmobiliaria del Dueño");
    expect(agencyInput).toBeDisabled();
  });

  it("un colaborador sin agency_name asignada (dueño con perfil incompleto) ve el campo editable como fallback", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    fetchMock.mockResolvedValueOnce(AUTHENTICATED_SESSION);
    fetchMock.mockResolvedValueOnce(
      profileResponse(false, { role: "collaborator", license_number: null, agency_name: null }),
    );

    renderGate();
    await waitFor(() => expect(screen.getByLabelText("Nombre")).toBeEnabled());
    fillStep1();
    await goToStep2();

    expect(screen.getByLabelText("Inmobiliaria")).toBeEnabled();
  });

  // --- Pase de UI (2026-09-04, puntos 3/4): código de país + 8 dígitos obligatorios ---

  it("el teléfono usa +54 (Argentina) por default", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    fetchMock.mockResolvedValueOnce(AUTHENTICATED_SESSION);
    fetchMock.mockResolvedValueOnce(profileResponse(false));

    renderGate();
    await waitFor(() => expect(screen.getByLabelText("Nombre")).toBeEnabled());

    expect(screen.getByRole("button", { name: "Código de país" })).toHaveTextContent(
      "Argentina (+54)",
    );
  });

  it("un número local con menos de 8 dígitos muestra error y no avanza al paso 2", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    fetchMock.mockResolvedValueOnce(AUTHENTICATED_SESSION);
    fetchMock.mockResolvedValueOnce(profileResponse(false));

    renderGate();
    await waitFor(() => expect(screen.getByLabelText("Nombre")).toBeEnabled());

    fillStep1("381555");

    const callsBefore = fetchMock.mock.calls.length;
    fireEvent.click(screen.getByRole("button", { name: /siguiente/i }));

    expect(await screen.findByText(/el teléfono debe tener 8 dígitos/i)).toBeInTheDocument();
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
    // Sigue en el paso 1 — Ciudad (paso 2) no está en pantalla.
    expect(screen.queryByRole("combobox", { name: "Ciudad" })).not.toBeInTheDocument();
  });

  // --- Pase de UI (2026-09-04, punto 8): 2 pasos con barra de progreso ---

  it("la barra de progreso avanza a medida que se completan los campos del paso 1", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    fetchMock.mockResolvedValueOnce(AUTHENTICATED_SESSION);
    fetchMock.mockResolvedValueOnce(profileResponse(false));

    renderGate();
    await waitFor(() => expect(screen.getByLabelText("Nombre")).toBeEnabled());

    expect(screen.getByText("Paso 1 de 2: Datos personales")).toBeInTheDocument();
    expect(screen.getByText("0/3")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Juan" } });
    expect(screen.getByText("1/3")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Apellido"), { target: { value: "Pérez" } });
    fireEvent.change(screen.getByLabelText("Número de teléfono"), {
      target: { value: "38155512" },
    });
    expect(screen.getByText("3/3")).toBeInTheDocument();
  });

  it("el botón Atrás en el paso 2 vuelve al paso 1 sin perder los datos ya cargados", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    fetchMock.mockResolvedValueOnce(AUTHENTICATED_SESSION);
    fetchMock.mockResolvedValueOnce(profileResponse(false));

    renderGate();
    await waitFor(() => expect(screen.getByLabelText("Nombre")).toBeEnabled());
    fillStep1();
    await goToStep2();

    fireEvent.click(screen.getByRole("button", { name: /atrás/i }));

    expect(screen.getByText("Paso 1 de 2: Datos personales")).toBeInTheDocument();
    expect(screen.getByLabelText("Nombre")).toHaveValue("Juan");
    expect(screen.getByLabelText("Número de teléfono")).toHaveValue("38155512");
  });
});
