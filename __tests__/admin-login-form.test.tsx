import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { AdminLoginForm } from "@/components/admin/AdminLoginForm";
import { AdminAuthProvider } from "@/lib/admin-auth-context";

function mockResponse(init: { ok: boolean; status: number; body?: string }): Response {
  return {
    ok: init.ok,
    status: init.status,
    text: async () => init.body ?? "",
  } as Response;
}

function wrapper({ children }: { children: ReactNode }) {
  return <AdminAuthProvider>{children}</AdminAuthProvider>;
}

describe("AdminLoginForm (KAN-239)", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  async function renderAdminLoginForm() {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        mockResponse({ ok: true, status: 200, body: JSON.stringify({ authenticated: false }) }),
      );
    render(<AdminLoginForm />, { wrapper });
    await waitFor(() => expect(screen.getByText("Panel admin")).toBeInTheDocument());
  }

  it("muestra el paso 1 por default", async () => {
    await renderAdminLoginForm();
    expect(screen.getByRole("button", { name: "Enviar Magic Link" })).toBeInTheDocument();
  });

  it("email inválido no llama a la red y muestra un error", async () => {
    await renderAdminLoginForm();
    const fetchCallsBefore = (global.fetch as jest.Mock).mock.calls.length;

    fireEvent.change(screen.getByPlaceholderText("admin@brokaza.com"), {
      target: { value: "no-es-un-email" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar Magic Link" }));

    expect(await screen.findByText("Ingresá un email válido.")).toBeInTheDocument();
    expect((global.fetch as jest.Mock).mock.calls.length).toBe(fetchCallsBefore);
  });

  it("submit válido pega a /admin/api/auth/request-magic-link y pasa al paso 2", async () => {
    await renderAdminLoginForm();
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockResponse({ ok: true, status: 200, body: "null" }),
    );

    fireEvent.change(screen.getByPlaceholderText("admin@brokaza.com"), {
      target: { value: "admin@brokaza.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar Magic Link" }));

    expect(await screen.findByText("Revisá tu email")).toBeInTheDocument();
    const [url] = (global.fetch as jest.Mock).mock.calls.at(-1);
    expect(url).toBe("/admin/api/auth/request-magic-link");
  });

  it("'Volver' desde el paso 2 vuelve al paso 1", async () => {
    await renderAdminLoginForm();
    (global.fetch as jest.Mock).mockResolvedValueOnce(
      mockResponse({ ok: true, status: 200, body: "null" }),
    );

    fireEvent.change(screen.getByPlaceholderText("admin@brokaza.com"), {
      target: { value: "admin@brokaza.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enviar Magic Link" }));
    await screen.findByText("Revisá tu email");

    fireEvent.click(screen.getByRole("button", { name: "Volver" }));

    expect(await screen.findByText("Panel admin")).toBeInTheDocument();
  });
});
