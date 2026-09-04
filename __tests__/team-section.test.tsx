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
    profile_completed: true,
    collaborator_status: "active",
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
        onReactivate={jest.fn()}
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
        onReactivate={jest.fn()}
      />,
    );
    expect(screen.getByText(/cargando equipo/i)).toBeInTheDocument();
  });

  it("muestra el placeholder sin colaboradores en la pestaña Activos", () => {
    render(
      <TeamSection
        status="loaded"
        collaborators={[]}
        error={null}
        onInvited={jest.fn()}
        onRevoke={jest.fn()}
        onReactivate={jest.fn()}
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
        onReactivate={jest.fn()}
      />,
    );
    expect(screen.getByText("Error interno.")).toBeInTheDocument();
  });

  // Pase de UI (2026-09-04, punto 5): el badge dejó de reflejar license_validation_status (que
  // un colaborador nunca deja en 'pending', no aplica) — ahora refleja profile_completed +
  // collaborator_status.
  it("renderiza cada colaborador con el badge derivado de profile_completed/collaborator_status", () => {
    render(
      <TeamSection
        status="loaded"
        collaborators={[
          buildCollaborator({ id: "c1", full_name: "Ana Gómez", profile_completed: false }),
          buildCollaborator({ id: "c2", full_name: "Beto Ruiz", profile_completed: true }),
        ]}
        error={null}
        onInvited={jest.fn()}
        onRevoke={jest.fn()}
        onReactivate={jest.fn()}
      />,
    );

    expect(screen.getByText("Ana Gómez")).toBeInTheDocument();
    expect(screen.getByText("Invitación pendiente")).toBeInTheDocument();
    expect(screen.getByText("Beto Ruiz")).toBeInTheDocument();
    expect(screen.getByText("Activo")).toBeInTheDocument();
  });

  it("la pestaña Activos no incluye colaboradores revocados, y la pestaña Revocados sí", () => {
    render(
      <TeamSection
        status="loaded"
        collaborators={[
          buildCollaborator({ id: "c1", full_name: "Ana Gómez", collaborator_status: "active" }),
          buildCollaborator({ id: "c2", full_name: "Beto Ruiz", collaborator_status: "revoked" }),
        ]}
        error={null}
        onInvited={jest.fn()}
        onRevoke={jest.fn()}
        onReactivate={jest.fn()}
      />,
    );

    expect(screen.getByText("Ana Gómez")).toBeInTheDocument();
    expect(screen.queryByText("Beto Ruiz")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Revocados" }));

    expect(screen.queryByText("Ana Gómez")).not.toBeInTheDocument();
    expect(screen.getByText("Beto Ruiz")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reactivar" })).toBeInTheDocument();
  });

  it("una invitación sin confirmar muestra 'Revocar'; un colaborador activo muestra 'Dar de baja' — ambos llaman a onRevoke", async () => {
    const onRevoke = jest.fn().mockResolvedValue(undefined);
    render(
      <TeamSection
        status="loaded"
        collaborators={[
          buildCollaborator({ id: "c1", full_name: "Ana Gómez", profile_completed: false }),
          buildCollaborator({ id: "c2", full_name: "Beto Ruiz", profile_completed: true }),
        ]}
        error={null}
        onInvited={jest.fn()}
        onRevoke={onRevoke}
        onReactivate={jest.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "Revocar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Dar de baja" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Dar de baja" }));
    const confirmHeading = await screen.findByRole("heading", { name: "Dar de baja acceso" });
    const modal = confirmHeading.closest("div")!.parentElement as HTMLElement;
    fireEvent.click(within(modal).getByRole("button", { name: "Dar de baja" }));

    await waitFor(() => expect(onRevoke).toHaveBeenCalledWith("c2"));
  });

  it("cancelar el modal de baja no llama a onRevoke", async () => {
    const onRevoke = jest.fn();
    render(
      <TeamSection
        status="loaded"
        collaborators={[buildCollaborator()]}
        error={null}
        onInvited={jest.fn()}
        onRevoke={onRevoke}
        onReactivate={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Dar de baja" }));
    const confirmHeading = await screen.findByRole("heading", { name: "Dar de baja acceso" });
    const modal = confirmHeading.closest("div")!.parentElement as HTMLElement;

    fireEvent.click(within(modal).getByRole("button", { name: "Cancelar" }));

    await waitFor(() =>
      expect(screen.queryByRole("heading", { name: "Dar de baja acceso" })).not.toBeInTheDocument(),
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
        onReactivate={jest.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Dar de baja" }));
    const confirmHeading = await screen.findByRole("heading", { name: "Dar de baja acceso" });
    const modal = confirmHeading.closest("div")!.parentElement as HTMLElement;
    fireEvent.click(within(modal).getByRole("button", { name: "Dar de baja" }));

    expect(await screen.findByText("No se pudo actualizar el acceso.")).toBeInTheDocument();
    expect(screen.getByText("Ana Gómez")).toBeInTheDocument();
  });

  it("reactivar un colaborador revocado llama a onReactivate", async () => {
    const onReactivate = jest.fn().mockResolvedValue(undefined);
    render(
      <TeamSection
        status="loaded"
        collaborators={[buildCollaborator({ collaborator_status: "revoked" })]}
        error={null}
        onInvited={jest.fn()}
        onRevoke={jest.fn()}
        onReactivate={onReactivate}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Revocados" }));
    fireEvent.click(screen.getByRole("button", { name: "Reactivar" }));

    await waitFor(() => expect(onReactivate).toHaveBeenCalledWith("c1"));
  });
});
