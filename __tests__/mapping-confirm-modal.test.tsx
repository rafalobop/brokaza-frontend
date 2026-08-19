import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MappingConfirmModal } from "@/components/upload/MappingConfirmModal";
import type { PendingMappingSheet } from "@/lib/upload-api";

function mockResponse(init: { ok: boolean; status: number; body?: unknown }): Response {
  return {
    ok: init.ok,
    status: init.status,
    text: async () => (init.body !== undefined ? JSON.stringify(init.body) : ""),
  } as Response;
}

const MAPPING_FIELDS_BODY = {
  version: 1,
  fields: ["domicilio", "precio", "piso_lote"],
  required: ["domicilio", "precio"],
};

const SHEET: PendingMappingSheet = {
  sheetName: "Hoja1",
  headers: ["Dirección", "Costo"],
  headerSignature: "costo|dirección",
  source: "heuristic",
  fields: [
    { field: "domicilio", header: "Dirección", confidence: 1, ambiguous: false, candidates: [] },
  ],
  unresolvedRequiredFields: ["precio"],
  ambiguousFields: [],
};

describe("MappingConfirmModal (KAN-217)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(mockResponse({ ok: true, status: 200, body: MAPPING_FIELDS_BODY }));
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("muestra el nombre de la hoja, el hint y precarga el header ya resuelto (domicilio)", async () => {
    render(
      <MappingConfirmModal
        sheets={[SHEET]}
        confirming={false}
        confirmError={null}
        stage={null}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(screen.getByText("Hoja1")).toBeInTheDocument();
    expect(
      screen.getByText("No pudimos reconocer todas las columnas de esta hoja."),
    ).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText("Domicilio")).toBeInTheDocument());
    const domicilioSelect = screen.getAllByRole("combobox")[0] as HTMLSelectElement;
    expect(domicilioSelect.value).toBe("Dirección");
  });

  it("bloquea la confirmación si falta un campo requerido y muestra un error estandarizado", async () => {
    const onConfirm = jest.fn();
    render(
      <MappingConfirmModal
        sheets={[SHEET]}
        confirming={false}
        confirmError={null}
        stage={null}
        onConfirm={onConfirm}
        onCancel={jest.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByText("Domicilio")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Confirmar y cargar" }));

    expect(
      await screen.findByText(/Completá los campos obligatorios antes de confirmar/),
    ).toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("confirma con la selección completa cuando todos los campos requeridos están elegidos", async () => {
    const onConfirm = jest.fn();
    render(
      <MappingConfirmModal
        sheets={[SHEET]}
        confirming={false}
        confirmError={null}
        stage={null}
        onConfirm={onConfirm}
        onCancel={jest.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByText("Precio")).toBeInTheDocument());
    const selects = screen.getAllByRole("combobox");
    const precioSelect = selects[1];
    fireEvent.change(precioSelect, { target: { value: "Costo" } });

    fireEvent.click(screen.getByRole("button", { name: "Confirmar y cargar" }));

    expect(onConfirm).toHaveBeenCalledWith({
      Hoja1: { domicilio: "Dirección", precio: "Costo" },
    });
  });

  it("muestra el error del backend (confirmError) sin pisar la validación local", async () => {
    render(
      <MappingConfirmModal
        sheets={[SHEET]}
        confirming={false}
        confirmError="El mapeo confirmado no resuelve los campos requeridos: precio"
        stage={null}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(
      await screen.findByText("El mapeo confirmado no resuelve los campos requeridos: precio"),
    ).toBeInTheDocument();
  });

  it('"Cancelar" llama a onCancel', async () => {
    const onCancel = jest.fn();
    render(
      <MappingConfirmModal
        sheets={[SHEET]}
        confirming={false}
        confirmError={null}
        stage={null}
        onConfirm={jest.fn()}
        onCancel={onCancel}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("deshabilita los controles mientras confirming=true", async () => {
    render(
      <MappingConfirmModal
        sheets={[SHEET]}
        confirming={true}
        confirmError={null}
        stage={null}
        onConfirm={jest.fn()}
        onCancel={jest.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Cargando..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancelar" })).toBeDisabled();
  });
});
