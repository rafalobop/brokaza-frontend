import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { LoginForm } from "@/components/auth/LoginForm";
import { AuthProvider } from "@/lib/auth-context";

function mockResponse(init: { ok: boolean; status: number; body?: string }): Response {
  return {
    ok: init.ok,
    status: init.status,
    text: async () => init.body ?? "",
  } as Response;
}

function wrapper({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}

describe("LoginForm (KAN-166)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  async function renderLoginForm() {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        mockResponse({ ok: true, status: 200, body: JSON.stringify({ authenticated: false }) }),
      );
    render(<LoginForm />, { wrapper });
    await waitFor(() => expect(screen.getByText("Ingresá a Brokaza")).toBeInTheDocument());
  }

  it("muestra el paso 1 por default con el botón deshabilitado hasta escribir un email", async () => {
    await renderLoginForm();

    expect(screen.getByRole("button", { name: "Enviar Magic Link" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("vos@inmobiliaria.com")).toHaveValue("");
  });

  it("email inválido no llama a la red y muestra un error", async () => {
    await renderLoginForm();
    const fetchCallsBefore = (global.fetch as jest.Mock).mock.calls.length;

    fireEvent.change(screen.getByPlaceholderText("vos@inmobiliaria.com"), {
      target: { value: "no-es-un-email" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar Magic Link" }));

    expect(await screen.findByText("Ingresá un email válido.")).toBeInTheDocument();
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(fetchCallsBefore);
  });

  it("submit válido pasa al paso 2 ('Revisá tu email')", async () => {
    await renderLoginForm();
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockResponse({ ok: true, status: 200, body: "null" }),
    );

    fireEvent.change(screen.getByPlaceholderText("vos@inmobiliaria.com"), {
      target: { value: "agente@brokaza.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar Magic Link" }));

    expect(await screen.findByText("Revisá tu email")).toBeInTheDocument();
    expect(screen.getByText("agente@brokaza.com")).toBeInTheDocument();
  });

  it("error del backend (ej. rate limit) se muestra inline en el paso 1", async () => {
    await renderLoginForm();
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockResponse({
        ok: false,
        status: 429,
        body: JSON.stringify({
          error: "Demasiados intentos. Esperá un minuto e intentá de nuevo.",
        }),
      }),
    );

    fireEvent.change(screen.getByPlaceholderText("vos@inmobiliaria.com"), {
      target: { value: "agente@brokaza.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar Magic Link" }));

    expect(
      await screen.findByText("Demasiados intentos. Esperá un minuto e intentá de nuevo."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar Magic Link" })).toBeInTheDocument();
  });

  it("'Volver' desde el paso 2 vuelve al paso 1", async () => {
    await renderLoginForm();
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockResponse({ ok: true, status: 200, body: "null" }),
    );

    fireEvent.change(screen.getByPlaceholderText("vos@inmobiliaria.com"), {
      target: { value: "agente@brokaza.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar Magic Link" }));
    await screen.findByText("Revisá tu email");

    fireEvent.click(screen.getByRole("button", { name: "Volver" }));

    expect(await screen.findByText("Ingresá a Brokaza")).toBeInTheDocument();
  });
});
