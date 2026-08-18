import { fireEvent, render, screen } from "@testing-library/react";
import { MatchesSection } from "@/components/matches/MatchesSection";
import type { Match } from "@/lib/matches-api";
import { ZONE_MATCH_REASON_PREFIX } from "@/lib/match-zone-tooltip";

function buildMatch(overrides: Partial<Match>): Match {
  return {
    id: "m1",
    fecha: "2026-01-01",
    searchText: "depto 2 dorm en alquiler",
    property: { domicilio: "Calle Falsa 123", precio: 1000, moneda: "USD", operacion: "alquiler" },
    reasons: [],
    score: 80,
    userReviewStatus: "PENDING",
    feedbackReason: null,
    ...overrides,
  };
}

describe("MatchesSection (KAN-189)", () => {
  it("muestra el estado de carga", () => {
    render(
      <MatchesSection status="loading" matches={[]} error={null} sendFeedback={jest.fn()} />,
    );
    expect(screen.getByText(/Cargando matches/)).toBeInTheDocument();
  });

  it("muestra el error de carga", () => {
    render(
      <MatchesSection
        status="error"
        matches={[]}
        error="Error al obtener los matches encontrados."
        sendFeedback={jest.fn()}
      />,
    );
    expect(screen.getByText("Error al obtener los matches encontrados.")).toBeInTheDocument();
  });

  it("muestra el placeholder cuando no hay matches", () => {
    render(<MatchesSection status="loaded" matches={[]} error={null} sendFeedback={jest.fn()} />);
    expect(screen.getByText(/No se han registrado matches/)).toBeInTheDocument();
  });

  it("renderiza los matches obtenidos de GET /api/matches (vía props)", () => {
    const match = buildMatch({});
    render(
      <MatchesSection status="loaded" matches={[match]} error={null} sendFeedback={jest.fn()} />,
    );
    expect(screen.getByText("Calle Falsa 123")).toBeInTheDocument();
    expect(screen.getByText('"depto 2 dorm en alquiler"')).toBeInTheDocument();
  });

  it("Aceptar llama a sendFeedback con status=ACCEPTED", () => {
    const sendFeedback = jest.fn().mockResolvedValue(undefined);
    const match = buildMatch({});
    render(
      <MatchesSection status="loaded" matches={[match]} error={null} sendFeedback={sendFeedback} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Aceptar" }));

    expect(sendFeedback).toHaveBeenCalledWith("m1", "ACCEPTED", null);
  });

  it("Rechazar abre el modal y confirmar llama a sendFeedback con status=REJECTED y el motivo elegido", () => {
    const sendFeedback = jest.fn().mockResolvedValue(undefined);
    const match = buildMatch({});
    render(
      <MatchesSection status="loaded" matches={[match]} error={null} sendFeedback={sendFeedback} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Rechazar" }));
    expect(screen.getByRole("heading", { name: "Rechazar Match" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Rechazar Match" }));

    expect(sendFeedback).toHaveBeenCalledWith(
      "m1",
      "REJECTED",
      "Mal filtrado (no es un pedido inmobiliario)",
    );
  });

  it("no muestra acciones aceptar/rechazar para un match ya curado", () => {
    const match = buildMatch({ userReviewStatus: "ACCEPTED" });
    render(
      <MatchesSection status="loaded" matches={[match]} error={null} sendFeedback={jest.fn()} />,
    );
    expect(screen.queryByRole("button", { name: "Aceptar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Rechazar" })).not.toBeInTheDocument();
  });

  it("muestra el motivo de un match rechazado", () => {
    const match = buildMatch({ userReviewStatus: "REJECTED", feedbackReason: "Precio incompatible" });
    render(
      <MatchesSection status="loaded" matches={[match]} error={null} sendFeedback={jest.fn()} />,
    );
    expect(screen.getByText("Motivo: Precio incompatible")).toBeInTheDocument();
  });

  it("el tooltip de zona geográfica se muestra solo para reasons con el prefijo esperado", () => {
    const match = buildMatch({
      reasons: [`${ZONE_MATCH_REASON_PREFIX} en Barrio Sur`, "Coincidencia de Precio"],
    });
    render(
      <MatchesSection status="loaded" matches={[match]} error={null} sendFeedback={jest.fn()} />,
    );

    const zoneReason = screen.getByText(`${ZONE_MATCH_REASON_PREFIX} en Barrio Sur`);
    expect(zoneReason).toHaveAttribute("title");

    const priceReason = screen.getByText("Coincidencia de Precio");
    expect(priceReason).not.toHaveAttribute("title");
  });
});
