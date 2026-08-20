import { render, screen } from "@testing-library/react";
import { ZoneBadge } from "@/components/admin/ZoneBadge";
import type { AdminProperty } from "@/lib/properties-api";

function property(overrides: Partial<AdminProperty>): AdminProperty {
  return {
    id: "p1",
    address: "Calle Falsa 123",
    latitude: -26.82,
    longitude: -65.2,
    zone: null,
    zoneSource: "none",
    textSuggestedZone: null,
    hasDiscrepancy: false,
    ...overrides,
  };
}

describe("ZoneBadge (KAN-240)", () => {
  it("zoneSource=point muestra el nombre de la zona sin sufijo", () => {
    render(
      <ZoneBadge
        property={property({
          zone: { id: "z1", name: "Barrio Sur", group_id: null },
          zoneSource: "point",
        })}
      />,
    );
    expect(screen.getByText("Barrio Sur")).toBeInTheDocument();
  });

  it("zoneSource=text muestra el sufijo '(por texto)'", () => {
    render(
      <ZoneBadge
        property={property({
          zone: { id: "z1", name: "Centro", group_id: null },
          zoneSource: "text",
        })}
      />,
    );
    expect(screen.getByText("Centro (por texto)")).toBeInTheDocument();
  });

  it("zoneSource=none muestra 'Sin zona resuelta'", () => {
    render(<ZoneBadge property={property({})} />);
    expect(screen.getByText("Sin zona resuelta")).toBeInTheDocument();
  });

  it("hasDiscrepancy muestra el ícono de alerta y el title con ambas zonas", () => {
    render(
      <ZoneBadge
        property={property({
          zone: { id: "z1", name: "Barrio Sur", group_id: null },
          zoneSource: "point",
          textSuggestedZone: { id: "z2", name: "Centro", group_id: null },
          hasDiscrepancy: true,
        })}
      />,
    );
    const badge = screen.getByText("⚠ Barrio Sur");
    expect(badge).toHaveAttribute("title", "Punto: Barrio Sur | Texto sugiere: Centro");
  });
});
