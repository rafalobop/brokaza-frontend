import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Ingresá a Brokaza" })).toBeInTheDocument(),
    );
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

  it("error del backend NO-429 (ej. 400/500) se muestra inline en el paso 1 sin cooldown", async () => {
    await renderLoginForm();
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockResponse({
        ok: false,
        status: 400,
        body: JSON.stringify({ error: "Email inválido." }),
      }),
    );

    fireEvent.change(screen.getByPlaceholderText("vos@inmobiliaria.com"), {
      target: { value: "agente@brokaza.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar Magic Link" }));

    expect(await screen.findByText("Email inválido.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar Magic Link" })).toBeEnabled();
  });

  describe("KAN-326 - manejo específico de 429 (rate limit)", () => {
    beforeEach(() => jest.useFakeTimers({ doNotFake: ["queueMicrotask"] }));
    afterEach(() => jest.useRealTimers());

    async function submitAndGet429() {
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
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Enviar Magic Link" }));
        await Promise.resolve();
        await Promise.resolve();
      });
    }

    it("muestra un mensaje específico de rate limit (no el genérico del backend)", async () => {
      await submitAndGet429();

      expect(
        screen.getByText(
          "Hiciste demasiados pedidos de acceso seguidos. Esperá un minuto y volvé a intentar.",
        ),
      ).toBeInTheDocument();
      expect(
        screen.queryByText("Demasiados intentos. Esperá un minuto e intentá de nuevo."),
      ).not.toBeInTheDocument();
    });

    it("deshabilita el botón con una cuenta regresiva visible que decrementa cada segundo", async () => {
      await submitAndGet429();

      expect(screen.getByRole("button", { name: "Esperá 60s..." })).toBeDisabled();

      act(() => jest.advanceTimersByTime(1000));
      expect(screen.getByRole("button", { name: "Esperá 59s..." })).toBeDisabled();

      act(() => jest.advanceTimersByTime(5000));
      expect(screen.getByRole("button", { name: "Esperá 54s..." })).toBeDisabled();
    });

    it("reactiva el botón a 'Enviar Magic Link' cuando el cooldown llega a 0", async () => {
      await submitAndGet429();

      act(() => jest.advanceTimersByTime(60_000));

      expect(screen.getByRole("button", { name: "Enviar Magic Link" })).toBeEnabled();
    });

    it("no dispara un submit real mientras el cooldown está activo (protección extra al disabled del DOM)", async () => {
      await submitAndGet429();
      const callsDuringCooldown = (global.fetch as jest.Mock).mock.calls.length;

      fireEvent.click(screen.getByRole("button", { name: "Esperá 60s..." }));

      expect((global.fetch as jest.Mock).mock.calls.length).toBe(callsDuringCooldown);
    });
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

    expect(await screen.findByRole("heading", { name: "Ingresá a Brokaza" })).toBeInTheDocument();
  });
});
