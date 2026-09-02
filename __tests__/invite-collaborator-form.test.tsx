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
    render(<InviteCollaboratorForm onInvited={jest.fn()} />);

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

    render(<InviteCollaboratorForm onInvited={onInvited} />);

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

    render(<InviteCollaboratorForm onInvited={jest.fn()} />);

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

    render(<InviteCollaboratorForm onInvited={onInvited} />);

    fireEvent.change(screen.getByPlaceholderText(/colaborador@ejemplo.com/), {
      target: { value: "no-existe@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /otorgar acceso/i }));

    expect(
      await screen.findByText(/no existe ninguna cuenta registrada con ese email/i),
    ).toBeInTheDocument();
    expect(onInvited).not.toHaveBeenCalled();
  });
});
