import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  zone: null,
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

  it("muestra la cantidad de dormitorios para casa/departamento pero no para terreno/local/oficina/otro", async () => {
    const properties: TenantProperty[] = [
      { ...SAMPLE_PROPERTY, id: "p-depto", property_type: "departamento", address: "Depto 1" },
      { ...SAMPLE_PROPERTY, id: "p-casa", property_type: "casa", address: "Casa 1" },
      { ...SAMPLE_PROPERTY, id: "p-terreno", property_type: "terreno", address: "Terreno 1" },
      { ...SAMPLE_PROPERTY, id: "p-local", property_type: "local", address: "Local 1" },
      { ...SAMPLE_PROPERTY, id: "p-oficina", property_type: "oficina", address: "Oficina 1" },
      { ...SAMPLE_PROPERTY, id: "p-otro", property_type: "otro", address: "Otro 1" },
    ];
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        mockResponse({ ok: true, status: 200, body: { properties, total: properties.length } }),
      );

    render(<PropertiesTable />);
    await screen.findByText("Depto 1");

    expect(screen.getAllByText("2 dorms.")).toHaveLength(2);
    ["Terreno 1", "Local 1", "Oficina 1", "Otro 1"].forEach((address) => {
      const row = screen.getByText(address).closest("div")!.parentElement as HTMLElement;
      expect(within(row).queryByText(/dorm/)).not.toBeInTheDocument();
    });
  });

  it("muestra el estado vacío cuando no hay propiedades", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        mockResponse({ ok: true, status: 200, body: { properties: [], total: 0 } }),
      );

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

  it("eliminar pide confirmación (modal propio) y hace DELETE", async () => {
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

    const confirmHeading = await screen.findByRole("heading", { name: "Eliminar propiedad" });
    const modal = confirmHeading.closest("div")!.parentElement as HTMLElement;
    fireEvent.click(within(modal).getByRole("button", { name: "Eliminar" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText("Calle Falsa 123")).not.toBeInTheDocument());
  });

  it("agregar propiedad abre el modal y hace POST al confirmar", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(
        mockResponse({ ok: true, status: 200, body: { properties: [], total: 0 } }),
      )
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
