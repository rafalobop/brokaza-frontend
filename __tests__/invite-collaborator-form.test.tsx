import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { InviteCollaboratorForm } from "@/components/team/InviteCollaboratorForm";

function mockResponse(init: { ok: boolean; status: number; body?: unknown }): Response {
  return {
    ok: init.ok,
    status: init.status,
    text: async () => (init.body !== undefined ? JSON.stringify(init.body) : ""),
  } as Response;
}

describe("InviteCollaboratorForm (KAN-306)", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("no envía nada si el email está vacío", () => {
    global.fetch = jest.fn();
    render(<InviteCollaboratorForm onInvited={jest.fn()} onReactivate={jest.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /otorgar acceso/i }));

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("envía POST /api/admin-panel/collaborators con el email, muestra éxito y llama a onInvited", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockResponse({
        ok: true,
        status: 200,
        body: {
          success: true,
          collaborator: {
            id: "c1",
            full_name: "Ana Gómez",
            email: "ana@example.com",
            license_number: "350",
            license_validation_status: "validated",
            created_at: "2026-09-01T00:00:00.000Z",
          },
        },
      }),
    );
    const onInvited = jest.fn();

    render(<InviteCollaboratorForm onInvited={onInvited} onReactivate={jest.fn()} />);

    fireEvent.change(screen.getByPlaceholderText(/colaborador@ejemplo.com/), {
      target: { value: "ana@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /otorgar acceso/i }));

    await waitFor(() => expect(onInvited).toHaveBeenCalledTimes(1));

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/admin-panel/collaborators",
      expect.objectContaining({ method: "POST" }),
    );
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ email: "ana@example.com" });
    expect(await screen.findByText("Acceso otorgado a ana@example.com.")).toBeInTheDocument();
  });

  it("limpia el input tras un envío exitoso", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockResponse({
        ok: true,
        status: 200,
        body: {
          success: true,
          collaborator: {
            id: "c1",
            full_name: "",
            email: "ana@example.com",
            license_number: null,
            license_validation_status: "pending",
            created_at: "2026-09-01T00:00:00.000Z",
          },
        },
      }),
    );

    render(<InviteCollaboratorForm onInvited={jest.fn()} onReactivate={jest.fn()} />);

    const input = screen.getByPlaceholderText(/colaborador@ejemplo.com/) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "ana@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /otorgar acceso/i }));

    await waitFor(() => expect(input.value).toBe(""));
  });

  it("muestra el error del backend (ej. 404, email no registrado) y no llama a onInvited", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockResponse({
        ok: false,
        status: 404,
        body: {
          error:
            "No existe ninguna cuenta registrada con ese email. El colaborador debe registrarse primero.",
        },
      }),
    );
    const onInvited = jest.fn();

    render(<InviteCollaboratorForm onInvited={onInvited} onReactivate={jest.fn()} />);

    fireEvent.change(screen.getByPlaceholderText(/colaborador@ejemplo.com/), {
      target: { value: "no-existe@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /otorgar acceso/i }));

    expect(
      await screen.findByText(/no existe ninguna cuenta registrada con ese email/i),
    ).toBeInTheDocument();
    expect(onInvited).not.toHaveBeenCalled();
  });

  // KAN-340: antes, reinvitar a un colaborador revocado daba el mismo 409 genérico que "ya es
  // colaborador activo", sin ninguna salida clara — ahora el backend distingue el caso con
  // `code: 'ALREADY_LINKED_REVOKED'` + `collaboratorId`, y el formulario ofrece reactivar ahí mismo.
  it("KAN-340 - ante 409 ALREADY_LINKED_REVOKED, muestra un botón para reactivar directo y llama a onReactivate con el id correcto", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockResponse({
        ok: false,
        status: 409,
        body: {
          error:
            'Ese usuario ya está vinculado a tu agencia, pero tiene el acceso revocado. Reactivalo desde la pestaña "Revocados" en vez de volver a invitarlo.',
          code: "ALREADY_LINKED_REVOKED",
          collaboratorId: "c-revoked-1",
        },
      }),
    );
    const onReactivate = jest.fn().mockResolvedValue(undefined);

    render(<InviteCollaboratorForm onInvited={jest.fn()} onReactivate={onReactivate} />);

    fireEvent.change(screen.getByPlaceholderText(/colaborador@ejemplo.com/), {
      target: { value: "revocado@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /otorgar acceso/i }));

    expect(await screen.findByText(/reactivalo desde la pestaña "revocados"/i)).toBeInTheDocument();
    const reactivateButton = await screen.findByRole("button", { name: /reactivar acceso/i });

    fireEvent.click(reactivateButton);

    await waitFor(() => expect(onReactivate).toHaveBeenCalledWith("c-revoked-1"));
    expect(await screen.findByText("Acceso reactivado.")).toBeInTheDocument();
  });

  it("KAN-340 - un 409 genérico (colaborador ya activo, sin code) NO muestra el botón de reactivar", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockResponse({
        ok: false,
        status: 409,
        body: { error: "Ese usuario ya es colaborador de tu agencia." },
      }),
    );

    render(<InviteCollaboratorForm onInvited={jest.fn()} onReactivate={jest.fn()} />);

    fireEvent.change(screen.getByPlaceholderText(/colaborador@ejemplo.com/), {
      target: { value: "activo@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /otorgar acceso/i }));

    expect(
      await screen.findByText("Ese usuario ya es colaborador de tu agencia."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /reactivar acceso/i })).not.toBeInTheDocument();
  });
});
