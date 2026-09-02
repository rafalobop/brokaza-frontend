import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { TeamSection } from "@/components/team/TeamSection";
import type { Collaborator } from "@/lib/team-api";

function buildCollaborator(overrides: Partial<Collaborator> = {}): Collaborator {
  return {
    id: "c1",
    full_name: "Ana Gómez",
    email: "ana@example.com",
    license_number: "350",
    license_validation_status: "validated",
    created_at: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("TeamSection (KAN-306)", () => {
  it("status='forbidden' muestra el mensaje explicativo, no el formulario ni la lista", () => {
    render(
      <TeamSection
        status="forbidden"
        collaborators={[]}
        error="Solo los dueños de agencia pueden acceder al panel de administración."
        onInvited={jest.fn()}
        onRevoke={jest.fn()}
      />,
    );

    expect(
      screen.getByText(/solo los dueños de agencia pueden acceder a esta sección/i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /otorgar acceso/i })).not.toBeInTheDocument();
  });

  it("muestra el estado de carga", () => {
    render(
      <TeamSection
        status="loading"
        collaborators={[]}
        error={null}
        onInvited={jest.fn()}
        onRevoke={jest.fn()}
      />,
    );
    expect(screen.getByText(/cargando equipo/i)).toBeInTheDocument();
  });

  it("muestra el placeholder sin colaboradores", () => {
    render(
      <TeamSection
        status="loaded"
        collaborators={[]}
        error={null}
        onInvited={jest.fn()}
        onRevoke={jest.fn()}
      />,
    );
    expect(
      screen.getByText(/todavía no otorgaste acceso a ningún colaborador/i),
    ).toBeInTheDocument();
  });

  it("muestra el error si status='error'", () => {
    render(
      <TeamSection
        status="error"
        collaborators={[]}
        error="Error interno."
        onInvited={jest.fn()}
        onRevoke={jest.fn()}
      />,
    );
    expect(screen.getByText("Error interno.")).toBeInTheDocument();
  });

  it("renderiza cada colaborador con su badge de estado de validación (AC6, supervisión)", () => {
    render(
      <TeamSection
        status="loaded"
        collaborators={[
          buildCollaborator({
            id: "c1",
            full_name: "Ana Gómez",
            license_validation_status: "validated",
          }),
          buildCollaborator({
            id: "c2",
            full_name: "Beto Ruiz",
            license_validation_status: "pending",
          }),
          buildCollaborator({
            id: "c3",
            full_name: "Cami Díaz",
            license_validation_status: "rejected",
          }),
        ]}
        error={null}
        onInvited={jest.fn()}
        onRevoke={jest.fn()}
      />,
    );

    expect(screen.getByText("Ana Gómez")).toBeInTheDocument();
    expect(screen.getByText("Matrícula validada")).toBeInTheDocument();
    expect(screen.getByText("Beto Ruiz")).toBeInTheDocument();
    expect(screen.getByText("Validación pendiente")).toBeInTheDocument();
    expect(screen.getByText("Cami Díaz")).toBeInTheDocument();
    expect(screen.getByText("Matrícula rechazada")).toBeInTheDocument();
  });

  it("revocar pide confirmación (modal propio) y llama a onRevoke solo al confirmar", async () => {
    const onRevoke = jest.fn().mockResolvedValue(undefined);
    render(
      <TeamSection
        status="loaded"
        collaborators={[buildCollaborator()]}
        error={null}
        onInvited={jest.fn()}
        onRevoke={onRevoke}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Revocar" }));

    const confirmHeading = await screen.findByRole("heading", { name: "Revocar acceso" });
    const modal = confirmHeading.closest("div")!.parentElement as HTMLElement;
    expect(onRevoke).not.toHaveBeenCalled();

    fireEvent.click(within(modal).getByRole("button", { name: "Revocar" }));

    await waitFor(() => expect(onRevoke).toHaveBeenCalledWith("c1"));
  });

  it("cancelar el modal de revocación no llama a onRevoke", async () => {
    const onRevoke = jest.fn();
    render(
      <TeamSection
        status="loaded"
        collaborators={[buildCollaborator()]}
        error={null}
        onInvited={jest.fn()}
        onRevoke={onRevoke}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Revocar" }));
    const confirmHeading = await screen.findByRole("heading", { name: "Revocar acceso" });
    const modal = confirmHeading.closest("div")!.parentElement as HTMLElement;

    fireEvent.click(within(modal).getByRole("button", { name: "Cancelar" }));

    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "Revocar acceso" })).not.toBeInTheDocument(),
    );
    expect(onRevoke).not.toHaveBeenCalled();
  });

  it("un error al revocar se muestra en la fila sin romper el resto de la lista", async () => {
    const onRevoke = jest.fn().mockRejectedValue(new Error("fallo simulado"));
    render(
      <TeamSection
        status="loaded"
        collaborators={[buildCollaborator()]}
        error={null}
        onInvited={jest.fn()}
        onRevoke={onRevoke}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Revocar" }));
    const confirmHeading = await screen.findByRole("heading", { name: "Revocar acceso" });
    const modal = confirmHeading.closest("div")!.parentElement as HTMLElement;
    fireEvent.click(within(modal).getByRole("button", { name: "Revocar" }));

    expect(await screen.findByText("No se pudo revocar el acceso.")).toBeInTheDocument();
    expect(screen.getByText("Ana Gómez")).toBeInTheDocument();
  });
});
