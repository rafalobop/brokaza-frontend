import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ActiveSearchesSection } from "@/components/matches/ActiveSearchesSection";
import type { ActiveSearch } from "@/lib/matches-api";

function buildSearch(overrides: Partial<ActiveSearch>): ActiveSearch {
  return {
    id: "s1",
    raw_text: "busco depto 2 dorm en alquiler",
    criteria: { operation: "alquiler", zones: ["Barrio Sur"] },
    status: "active",
    created_at: "2026-01-01T00:00:00.000Z",
    expires_at: "2026-01-08T00:00:00.000Z",
    days_remaining: 5,
    matches_count: 2,
    ...overrides,
  };
}

describe("ActiveSearchesSection (KAN-191)", () => {
  it("muestra el estado de carga", () => {
    render(
      <ActiveSearchesSection
        status="loading"
        searches={[]}
        error={null}
        onArchive={jest.fn()}
        onReactivate={jest.fn()}
      />,
    );
    expect(screen.getByText(/Cargando búsquedas activas/)).toBeInTheDocument();
  });

  it("muestra el placeholder sin búsquedas activas", () => {
    render(
      <ActiveSearchesSection
        status="loaded"
        searches={[]}
        error={null}
        onArchive={jest.fn()}
        onReactivate={jest.fn()}
      />,
    );
    expect(screen.getByText(/No hay búsquedas en esta categoría/)).toBeInTheDocument();
  });

  it("renderiza el resumen y el texto original de la búsqueda", () => {
    const search = buildSearch({});
    render(
      <ActiveSearchesSection
        status="loaded"
        searches={[search]}
        error={null}
        onArchive={jest.fn()}
        onReactivate={jest.fn()}
      />,
    );
    expect(screen.getByText(/Alquiler.*Barrio Sur/)).toBeInTheDocument();
    expect(screen.getByText('"busco depto 2 dorm en alquiler"')).toBeInTheDocument();
  });

  it("una búsqueda activa muestra Archivar pero no Reactivar", () => {
    const search = buildSearch({ status: "active" });
    render(
      <ActiveSearchesSection
        status="loaded"
        searches={[search]}
        error={null}
        onArchive={jest.fn()}
        onReactivate={jest.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Archivar" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reactivar" })).not.toBeInTheDocument();
  });

  it("una búsqueda vencida muestra Reactivar y no el badge de días restantes", () => {
    const search = buildSearch({ status: "expired", days_remaining: 0 });
    render(
      <ActiveSearchesSection
        status="loaded"
        searches={[search]}
        error={null}
        onArchive={jest.fn()}
        onReactivate={jest.fn()}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Vencidas" }));
    expect(screen.getByRole("button", { name: "Reactivar" })).toBeInTheDocument();
    expect(screen.queryByText(/restante/)).not.toBeInTheDocument();
  });

  it("Archivar pide confirmación y llama a onArchive si se confirma", async () => {
    const onArchive = jest.fn().mockResolvedValue(undefined);
    const search = buildSearch({});
    render(
      <ActiveSearchesSection
        status="loaded"
        searches={[search]}
        error={null}
        onArchive={onArchive}
        onReactivate={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Archivar" }));

    expect(screen.getByText("Archivar búsqueda")).toBeInTheDocument();
    const archiveButtons = screen.getAllByRole("button", { name: "Archivar" });
    fireEvent.click(archiveButtons[archiveButtons.length - 1]);

    await waitFor(() => expect(onArchive).toHaveBeenCalledWith("s1"));
  });

  it("Archivar no llama a onArchive si el usuario cancela la confirmación", () => {
    const onArchive = jest.fn();
    const search = buildSearch({});
    render(
      <ActiveSearchesSection
        status="loaded"
        searches={[search]}
        error={null}
        onArchive={onArchive}
        onReactivate={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Archivar" }));
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

    expect(screen.queryByText("Archivar búsqueda")).not.toBeInTheDocument();
    expect(onArchive).not.toHaveBeenCalled();
  });

  it("Reactivar llama a onReactivate sin pedir confirmación", () => {
    const onReactivate = jest.fn().mockResolvedValue(undefined);
    const search = buildSearch({ status: "expired", days_remaining: 0 });
    render(
      <ActiveSearchesSection
        status="loaded"
        searches={[search]}
        error={null}
        onArchive={jest.fn()}
        onReactivate={onReactivate}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Vencidas" }));
    fireEvent.click(screen.getByRole("button", { name: "Reactivar" }));

    expect(onReactivate).toHaveBeenCalledWith("s1");
    expect(screen.queryByText("Archivar búsqueda")).not.toBeInTheDocument();
  });

  it("el tab Archivadas agrupa 'cancelled'/'matched' y no muestra acciones", () => {
    const cancelled = buildSearch({ id: "s1", status: "cancelled" });
    const matched = buildSearch({ id: "s2", status: "matched" });
    const active = buildSearch({ id: "s3", status: "active" });
    render(
      <ActiveSearchesSection
        status="loaded"
        searches={[cancelled, matched, active]}
        error={null}
        onArchive={jest.fn()}
        onReactivate={jest.fn()}
      />,
    );

    // Por default, tab "Activas": solo la búsqueda activa.
    expect(screen.getAllByRole("button", { name: "Archivar" })).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Archivadas" }));
    expect(screen.getAllByText("Archivada")).toHaveLength(2);
    expect(screen.queryByRole("button", { name: "Archivar" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Reactivar" })).not.toBeInTheDocument();
  });
});
