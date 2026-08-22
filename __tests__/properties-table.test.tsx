import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { PropertiesTable } from "@/components/properties/PropertiesTable";
import type { TenantProperty } from "@/lib/tenant-properties-api";

function mockResponse(init: { ok: boolean; status: number; body?: unknown }): Response {
  return {
    ok: init.ok,
    status: init.status,
    text: async () => (init.body !== undefined ? JSON.stringify(init.body) : ""),
  } as Response;
}

const SAMPLE_PROPERTY: TenantProperty = {
  id: "p1",
  address: "Calle Falsa 123",
  floor: null,
  unit: null,
  block: null,
  lot: null,
  price: 1000,
  currency: "USD",
  maintenance_fees: 0,
  bedrooms: 2,
  features: null,
  contact_info: null,
  operation: "alquiler",
  property_type: "departamento",
  sheet_name: "Alta manual",
  latitude: null,
  longitude: null,
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: "2026-08-01T00:00:00.000Z",
};

describe("PropertiesTable (KAN-273)", () => {
  const originalFetch = global.fetch;
  const originalConfirm = window.confirm;

  afterEach(() => {
    global.fetch = originalFetch;
    window.confirm = originalConfirm;
  });

  it("lista las propiedades cargadas", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        mockResponse({ ok: true, status: 200, body: { properties: [SAMPLE_PROPERTY], total: 1 } }),
      );

    render(<PropertiesTable />);

    expect(await screen.findByText("Calle Falsa 123")).toBeInTheDocument();
    expect(screen.getByText("1 propiedad cargada.")).toBeInTheDocument();
  });

  it("muestra el estado vacío cuando no hay propiedades", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(mockResponse({ ok: true, status: 200, body: { properties: [], total: 0 } }));

    render(<PropertiesTable />);

    expect(
      await screen.findByText("No hay propiedades que coincidan con los filtros actuales."),
    ).toBeInTheDocument();
  });

  it("expandir una fila muestra el form de edición prellenado", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        mockResponse({ ok: true, status: 200, body: { properties: [SAMPLE_PROPERTY], total: 1 } }),
      );

    render(<PropertiesTable />);
    await screen.findByText("Calle Falsa 123");

    fireEvent.click(screen.getByRole("button", { name: "Editar" }));

    const addressInput = screen.getByDisplayValue("Calle Falsa 123") as HTMLInputElement;
    expect(addressInput).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar cambios" })).toBeInTheDocument();
  });

  it("eliminar pide confirmación y hace DELETE", async () => {
    window.confirm = jest.fn(() => true);
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        mockResponse({ ok: true, status: 200, body: { properties: [SAMPLE_PROPERTY], total: 1 } }),
      )
      .mockResolvedValueOnce(mockResponse({ ok: true, status: 200, body: { success: true } }));
    global.fetch = fetchMock;

    render(<PropertiesTable />);
    await screen.findByText("Calle Falsa 123");

    fireEvent.click(screen.getByRole("button", { name: "Eliminar" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    expect(window.confirm).toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText("Calle Falsa 123")).not.toBeInTheDocument());
  });

  it("agregar propiedad abre el modal y hace POST al confirmar", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(mockResponse({ ok: true, status: 200, body: { properties: [], total: 0 } }))
      .mockResolvedValueOnce(
        mockResponse({ ok: true, status: 201, body: { property: SAMPLE_PROPERTY } }),
      )
      .mockResolvedValueOnce(
        mockResponse({ ok: true, status: 200, body: { properties: [SAMPLE_PROPERTY], total: 1 } }),
      );
    global.fetch = fetchMock;

    render(<PropertiesTable />);
    await screen.findByText("No hay propiedades que coincidan con los filtros actuales.");

    fireEvent.click(screen.getByRole("button", { name: "Agregar propiedad" }));
    expect(screen.getByRole("heading", { name: "Agregar propiedad" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Dirección *"), {
      target: { value: "Av. Siempreviva 742" },
    });
    fireEvent.change(screen.getByLabelText("Precio *"), { target: { value: "1500" } });

    fireEvent.click(screen.getByRole("button", { name: "Crear propiedad" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const [postUrl, postInit] = fetchMock.mock.calls[1];
    expect(postUrl).toBe("/api/catalog/properties");
    const body = JSON.parse(postInit.body as string);
    expect(body.address).toBe("Av. Siempreviva 742");
    expect(body.price).toBe(1500);
  });
});
