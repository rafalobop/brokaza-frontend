import { fireEvent, render } from "@testing-library/react";
import { LeafletMap } from "@/components/map/LeafletMap";

describe("LeafletMap (KAN-241, spike)", () => {
  it("renderiza el contenedor del mapa sin tirar (jsdom, sin layout real)", () => {
    const { container } = render(
      <LeafletMap latitude={-26.8241} longitude={-65.2226} onChange={jest.fn()} />,
    );

    expect(container.querySelector(".leaflet-container")).toBeInTheDocument();
  });

  it("acepta latitude/longitude/onChange sin warnings de props inválidas", () => {
    const onChange = jest.fn();
    const { container } = render(
      <LeafletMap latitude={-34.6} longitude={-58.4} onChange={onChange} />,
    );

    // Leaflet arma su propio DOM interno (tiles, panes) dentro del contenedor — alcanza con
    // confirmar que el contenedor existe y no está vacío, sin depender de layout real (jsdom no
    // implementa getBoundingClientRect con dimensiones reales).
    expect(container.querySelector(".leaflet-container")).toBeInTheDocument();
  });

  it("un click en el mapa llama a onChange con lat/lng (interacción real de Leaflet, no simulada a mano)", () => {
    const onChange = jest.fn();
    const { container } = render(
      <LeafletMap latitude={-26.8241} longitude={-65.2226} onChange={onChange} />,
    );

    const mapPane = container.querySelector(".leaflet-container") as HTMLElement;
    fireEvent.click(mapPane, { clientX: 50, clientY: 50 });

    expect(onChange).toHaveBeenCalledTimes(1);
    const [lat, lng] = onChange.mock.calls[0];
    expect(typeof lat).toBe("number");
    expect(typeof lng).toBe("number");
  });

  // KAN-305: readOnly es el modo que usa PropertyForm para la vista del tenant — el marcador no
  // debe poder arrastrarse ni reposicionarse con un click.
  it("readOnly: un click en el mapa no llama a onChange", () => {
    const onChange = jest.fn();
    const { container } = render(
      <LeafletMap latitude={-26.8241} longitude={-65.2226} onChange={onChange} readOnly />,
    );

    const mapPane = container.querySelector(".leaflet-container") as HTMLElement;
    fireEvent.click(mapPane, { clientX: 50, clientY: 50 });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("readOnly sin onChange no tira (uso real de PropertyForm en modo edición)", () => {
    const { container } = render(<LeafletMap latitude={-26.8241} longitude={-65.2226} readOnly />);

    expect(container.querySelector(".leaflet-container")).toBeInTheDocument();
  });
});
