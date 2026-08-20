import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PropertyList } from "@/components/admin/PropertyList";

function mockResponse(init: { ok: boolean; status: number; body?: unknown }): Response {
  return {
    ok: init.ok,
    status: init.status,
    text: async () => (init.body !== undefined ? JSON.stringify(init.body) : ""),
  } as Response;
}

const SAMPLE_PROPERTY = {
  id: "p1",
  address: "Calle Falsa 123",
  latitude: -26.82,
  longitude: -65.2,
  zone: { id: "z1", name: "Barrio Sur", group_id: null },
  zoneSource: "point" as const,
  textSuggestedZone: null,
  hasDiscrepancy: false,
};

describe("PropertyList (KAN-240)", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("renderiza el listado con dirección, zona y coordenadas", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockResponse({
        ok: true,
        status: 200,
        body: { properties: [SAMPLE_PROPERTY], page: 1, pageSize: 50, total: 1 },
      }),
    );

    render(<PropertyList />);

    expect(await screen.findByText("Calle Falsa 123")).toBeInTheDocument();
    expect(screen.getByText("Barrio Sur")).toBeInTheDocument();
    expect(screen.getByText("-26.820000, -65.200000")).toBeInTheDocument();
    expect(screen.getByText("Página 1 de 1")).toBeInTheDocument();
  });

  it("propiedad sin coordenadas muestra '(sin coordenadas)'", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockResponse({
        ok: true,
        status: 200,
        body: {
          properties: [{ ...SAMPLE_PROPERTY, latitude: null, longitude: null }],
          page: 1,
          pageSize: 50,
          total: 1,
        },
      }),
    );

    render(<PropertyList />);

    expect(await screen.findByText("(sin coordenadas)")).toBeInTheDocument();
  });

  it("sin resultados muestra el mensaje vacío", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockResponse({
        ok: true,
        status: 200,
        body: { properties: [], page: 1, pageSize: 50, total: 0 },
      }),
    );

    render(<PropertyList />);

    expect(await screen.findByText("No se encontraron propiedades.")).toBeInTheDocument();
  });

  it("los botones de paginación respetan los límites", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockResponse({
        ok: true,
        status: 200,
        body: { properties: [SAMPLE_PROPERTY], page: 1, pageSize: 50, total: 1 },
      }),
    );

    render(<PropertyList />);
    await screen.findByText("Calle Falsa 123");

    expect(screen.getByRole("button", { name: "Anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();
  });

  it("escribir en el buscador termina pegando a /admin/api/properties con search", async () => {
    jest.useFakeTimers();
    const fetchMock = jest.fn().mockResolvedValue(
      mockResponse({
        ok: true,
        status: 200,
        body: { properties: [], page: 1, pageSize: 50, total: 0 },
      }),
    );
    global.fetch = fetchMock;

    render(<PropertyList />);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    fireEvent.change(screen.getByPlaceholderText("Buscar por dirección..."), {
      target: { value: "Falsa" },
    });

    fireEvent.change(screen.getByPlaceholderText("Buscar por dirección..."), {
      target: { value: "Falsa" },
    });
    jest.advanceTimersByTime(350);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(fetchMock).toHaveBeenLastCalledWith(
      "/admin/api/properties?page=1&search=Falsa",
      expect.objectContaining({}),
    );
    jest.useRealTimers();
  });

  it("muestra el error del backend si falla la carga", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        mockResponse({ ok: false, status: 500, body: { error: "Error interno." } }),
      );

    render(<PropertyList />);

    expect(await screen.findByText("Error interno.")).toBeInTheDocument();
  });
});
