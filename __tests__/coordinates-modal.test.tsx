import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { CoordinatesModal } from "@/components/admin/CoordinatesModal";
import type { AdminProperty } from "@/lib/properties-api";

function mockResponse(init: { ok: boolean; status: number; body?: unknown }): Response {
  return {
    ok: init.ok,
    status: init.status,
    text: async () => (init.body !== undefined ? JSON.stringify(init.body) : ""),
  } as Response;
}

const PROPERTY: AdminProperty = {
  id: "p1",
  address: "Calle Falsa 123",
  latitude: -26.82,
  longitude: -65.2,
  zone: null,
  zoneSource: "none",
  textSuggestedZone: null,
  hasDiscrepancy: false,
};

describe("CoordinatesModal (KAN-242)", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
  });

  it("precarga los inputs con las coordenadas actuales de la propiedad", async () => {
    render(<CoordinatesModal property={PROPERTY} onClose={jest.fn()} onSaved={jest.fn()} />);

    await waitFor(() => expect(screen.getByDisplayValue("-26.82")).toBeInTheDocument());
    expect(screen.getByDisplayValue("-65.2")).toBeInTheDocument();
  });

  it("propiedad sin coordenadas precarga con TUCUMAN_DEFAULT", async () => {
    render(
      <CoordinatesModal
        property={{ ...PROPERTY, latitude: null, longitude: null } as unknown as AdminProperty}
        onClose={jest.fn()}
        onSaved={jest.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByDisplayValue("-26.8241")).toBeInTheDocument());
    expect(screen.getByDisplayValue("-65.2226")).toBeInTheDocument();
  });

  it("rechaza coordenadas fuera de rango sin llamar a la red", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    render(<CoordinatesModal property={PROPERTY} onClose={jest.fn()} onSaved={jest.fn()} />);

    fireEvent.change(screen.getByDisplayValue("-26.82"), { target: { value: "500" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("Latitud/longitud fuera de rango.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("guarda con éxito: llama a onSaved, muestra 'Guardado.' y cierra tras el delay", async () => {
    jest.useFakeTimers({ doNotFake: ["queueMicrotask"] });
    global.fetch = jest.fn().mockResolvedValue(
      mockResponse({
        ok: true,
        status: 200,
        body: { success: true, latitude: -26.82, longitude: -65.2, zone: null, zoneSource: "none" },
      }),
    );
    const onSaved = jest.fn();
    const onClose = jest.fn();

    render(<CoordinatesModal property={PROPERTY} onClose={onClose} onSaved={onSaved} />);

    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(screen.getByText("Guardado.")).toBeInTheDocument());
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    jest.advanceTimersByTime(600);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("muestra el error del backend si falla el guardado, sin cerrar el modal", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        mockResponse({ ok: false, status: 404, body: { error: "Propiedad no encontrada." } }),
      );
    const onClose = jest.fn();

    render(<CoordinatesModal property={PROPERTY} onClose={onClose} onSaved={jest.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(await screen.findByText("Propiedad no encontrada.")).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("'Cancelar' llama a onClose sin guardar", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;
    const onClose = jest.fn();

    render(<CoordinatesModal property={PROPERTY} onClose={onClose} onSaved={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("editar el input de latitud manualmente actualiza el valor antes de guardar", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockResponse({
        ok: true,
        status: 200,
        body: { success: true, latitude: -10, longitude: -65.2, zone: null, zoneSource: "none" },
      }),
    );

    render(<CoordinatesModal property={PROPERTY} onClose={jest.fn()} onSaved={jest.fn()} />);

    fireEvent.change(screen.getByDisplayValue("-26.82"), { target: { value: "-10" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

    await waitFor(() => expect(global.fetch).toHaveBeenCalled());
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ latitude: -10, longitude: -65.2 });
  });
});
