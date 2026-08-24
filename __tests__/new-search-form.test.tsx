import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NewSearchForm } from "@/components/matches/NewSearchForm";

function mockResponse(init: { ok: boolean; status: number; body?: unknown }): Response {
  return {
    ok: init.ok,
    status: init.status,
    text: async () => (init.body !== undefined ? JSON.stringify(init.body) : ""),
  } as Response;
}

describe("NewSearchForm (KAN-191)", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("muestra un error si se intenta enviar sin texto", () => {
    render(<NewSearchForm onSubmitted={jest.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));

    expect(screen.getByText("Escribí qué estás buscando antes de guardar.")).toBeInTheDocument();
  });

  it("envía POST /api/search con el texto, muestra éxito y llama a onSubmitted", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(mockResponse({ ok: true, status: 200, body: { success: true } }));
    const onSubmitted = jest.fn();

    render(<NewSearchForm onSubmitted={onSubmitted} />);

    fireEvent.change(screen.getByPlaceholderText(/Busco depto/), {
      target: { value: "busco depto 2 dorm en alquiler" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));

    await waitFor(() => expect(onSubmitted).toHaveBeenCalledTimes(1));

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/search",
      expect.objectContaining({ method: "POST" }),
    );
    const [, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(JSON.parse(init.body)).toEqual({ text: "busco depto 2 dorm en alquiler" });
    expect(
      await screen.findByText('¡Búsqueda guardada! Ya aparece en "Mis búsquedas activas".'),
    ).toBeInTheDocument();
  });

  it("limpia el textarea tras un envío exitoso", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(mockResponse({ ok: true, status: 200, body: { success: true } }));

    render(<NewSearchForm onSubmitted={jest.fn()} />);

    const textarea = screen.getByPlaceholderText(/Busco depto/) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "busco depto" } });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));

    await waitFor(() => expect(textarea.value).toBe(""));
  });

  it("muestra el error del backend si la búsqueda falla", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        mockResponse({ ok: false, status: 429, body: { error: "Demasiadas búsquedas." } }),
      );

    render(<NewSearchForm onSubmitted={jest.fn()} />);

    fireEvent.change(screen.getByPlaceholderText(/Busco depto/), {
      target: { value: "busco depto" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Buscar" }));

    expect(await screen.findByText("Demasiadas búsquedas.")).toBeInTheDocument();
  });

  it("filtra caracteres de control en vivo y actualiza el contador", () => {
    render(<NewSearchForm onSubmitted={jest.fn()} />);

    const textarea = screen.getByPlaceholderText(/Busco depto/) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "abc\x00def" } });

    expect(textarea.value).toBe("abcdef");
    expect(screen.getByText("6/200")).toBeInTheDocument();
  });
});
