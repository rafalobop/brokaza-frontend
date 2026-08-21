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

  it("'Corregir' abre el modal de coordenadas para esa propiedad (KAN-242)", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockResponse({
        ok: true,
        status: 200,
        body: { properties: [SAMPLE_PROPERTY], page: 1, pageSize: 50, total: 1 },
      }),
    );

    render(<PropertyList />);
    await screen.findByText("Calle Falsa 123");

    expect(screen.queryByText("Corregir coordenadas")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Corregir" }));

    expect(await screen.findByText("Corregir coordenadas")).toBeInTheDocument();
    expect(screen.getAllByText("Calle Falsa 123").length).toBeGreaterThan(0);
  });

  it("guardar coordenadas en el modal refresca el listado y lo cierra", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    fetchMock.mockResolvedValue(
      mockResponse({
        ok: true,
        status: 200,
        body: { properties: [SAMPLE_PROPERTY], page: 1, pageSize: 50, total: 1 },
      }),
    );

    render(<PropertyList />);
    await screen.findByText("Calle Falsa 123");
    const callsBeforeSave = fetchMock.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: "Corregir" }));
    await screen.findByText("Corregir coordenadas");

    fetchMock.mockResolvedValueOnce(
      mockResponse({
        ok: true,
        status: 200,
        body: { success: true, latitude: -26.82, longitude: -65.2, zone: null, zoneSource: "none" },
      }),
    );

    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(fetchMock.mock.calls.length).toBe(callsBeforeSave + 2)); // PATCH + refresh
    const patchCall = fetchMock.mock.calls.find(([url]) => String(url).includes("/coordinates"));
    expect(patchCall?.[0]).toBe("/admin/api/properties/p1/coordinates");
  });

  it("'Cancelar' en el modal lo cierra sin refrescar el listado", async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      mockResponse({
        ok: true,
        status: 200,
        body: { properties: [SAMPLE_PROPERTY], page: 1, pageSize: 50, total: 1 },
      }),
    );
    global.fetch = fetchMock;

    render(<PropertyList />);
    await screen.findByText("Calle Falsa 123");
    const callsBeforeCancel = fetchMock.mock.calls.length;

    fireEvent.click(screen.getByRole("button", { name: "Corregir" }));
    await screen.findByText("Corregir coordenadas");

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByText("Corregir coordenadas")).not.toBeInTheDocument();
    expect(fetchMock.mock.calls.length).toBe(callsBeforeCancel);
  });
});
