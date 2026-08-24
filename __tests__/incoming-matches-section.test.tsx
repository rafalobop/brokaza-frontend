import { render, screen } from "@testing-library/react";
import { IncomingMatchesSection } from "@/components/matches/IncomingMatchesSection";
import type { IncomingMatch } from "@/lib/matches-api";
import { ZONE_MATCH_REASON_PREFIX } from "@/lib/match-zone-tooltip";

function buildIncomingMatch(overrides: Partial<IncomingMatch>): IncomingMatch {
  return {
    id: "im1",
    fecha: "2026-01-01",
    searchText: "depto 2 dorm en alquiler",
    searcherContact: {
      full_name: "Juana Pérez",
      phone_number: "+54 381 555-5555",
      agency_name: "Inmobiliaria Test",
      email: "juana@example.com",
    },
    property: { domicilio: "Calle Falsa 123", precio: 1000, moneda: "USD", operacion: "alquiler" },
    reasons: [],
    score: 70,
    ...overrides,
  };
}

describe("IncomingMatchesSection (KAN-190)", () => {
  it("muestra el estado de carga", () => {
    render(<IncomingMatchesSection status="loading" matches={[]} error={null} />);
    expect(screen.getByText(/Cargando interesados/)).toBeInTheDocument();
  });

  it("muestra el error de carga", () => {
    render(
      <IncomingMatchesSection
        status="error"
        matches={[]}
        error="Error al obtener los interesados en tus propiedades."
      />,
    );
    expect(
      screen.getByText("Error al obtener los interesados en tus propiedades."),
    ).toBeInTheDocument();
  });

  it("muestra el placeholder cuando nadie buscó ninguna propiedad", () => {
    render(<IncomingMatchesSection status="loaded" matches={[]} error={null} />);
    expect(screen.getByText(/Todavía nadie buscó/)).toBeInTheDocument();
  });

  it("renderiza los matches entrantes con datos de contacto", () => {
    const match = buildIncomingMatch({});
    render(<IncomingMatchesSection status="loaded" matches={[match]} error={null} />);

    expect(screen.getByText("Calle Falsa 123")).toBeInTheDocument();
    expect(screen.getByText(/Juana Pérez/)).toBeInTheDocument();
    expect(screen.getByText(/Inmobiliaria Test/)).toBeInTheDocument();
  });

  it("no muestra ninguna acción de aceptar/rechazar (solo lectura)", () => {
    const match = buildIncomingMatch({});
    render(<IncomingMatchesSection status="loaded" matches={[match]} error={null} />);

    expect(screen.queryByRole("button", { name: "Aceptar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rechazar" })).not.toBeInTheDocument();
  });

  it("el link de WhatsApp usa solo dígitos del teléfono", () => {
    const match = buildIncomingMatch({
      searcherContact: {
        full_name: "Juana Pérez",
        phone_number: "+54 381 555-5555",
        agency_name: null,
        email: null,
      },
    });
    render(<IncomingMatchesSection status="loaded" matches={[match]} error={null} />);

    const link = screen.getByRole("link", { name: "+54 381 555-5555" });
    expect(link).toHaveAttribute("href", "https://wa.me/543815555555");
  });

  it("el link de mailto usa el email del contacto", () => {
    const match = buildIncomingMatch({
      searcherContact: {
        full_name: null,
        phone_number: null,
        agency_name: null,
        email: "juana@example.com",
      },
    });
    render(<IncomingMatchesSection status="loaded" matches={[match]} error={null} />);

    const link = screen.getByRole("link", { name: "juana@example.com" });
    expect(link).toHaveAttribute("href", "mailto:juana@example.com");
  });

  it("muestra 'Sin datos de contacto' cuando no hay nombre ni inmobiliaria", () => {
    const match = buildIncomingMatch({
      searcherContact: { full_name: null, phone_number: null, agency_name: null, email: null },
    });
    render(<IncomingMatchesSection status="loaded" matches={[match]} error={null} />);

    expect(screen.getByText(/Sin datos de contacto/)).toBeInTheDocument();
  });

  it("filtra el motivo de Coincidencia de Zona Geográfica del listado de razones", () => {
    const match = buildIncomingMatch({
      reasons: [`${ZONE_MATCH_REASON_PREFIX} en Barrio Sur`, "Coincidencia de Precio"],
    });
    render(<IncomingMatchesSection status="loaded" matches={[match]} error={null} />);

    expect(screen.queryByText(`${ZONE_MATCH_REASON_PREFIX} en Barrio Sur`)).not.toBeInTheDocument();
    expect(screen.getByText("Coincidencia de Precio")).toBeInTheDocument();
  });
});
