import { fireEvent, render, screen } from "@testing-library/react";
import { UploadDropzone } from "@/components/upload/UploadDropzone";

function mockResponse(init: { ok: boolean; status: number; body?: unknown }): Response {
  return {
    ok: init.ok,
    status: init.status,
    text: async () => (init.body !== undefined ? JSON.stringify(init.body) : ""),
  } as Response;
}

function excelFile(name = "cartera.xlsx"): File {
  return new File(["contenido"], name, {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

describe("UploadDropzone (KAN-216)", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("muestra el texto inicial de la zona de drag&drop", () => {
    render(<UploadDropzone />);
    expect(
      screen.getByText("Soltá el archivo acá o hacé click para elegirlo (.xlsx)"),
    ).toBeInTheDocument();
  });

  it("click en la zona abre el selector de archivo (input file)", () => {
    render(<UploadDropzone />);
    const input = screen.getByTestId("upload-file-input") as HTMLInputElement;
    const clickSpy = jest.spyOn(input, "click");

    fireEvent.click(screen.getByTestId("upload-dropzone"));

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it("soltar un .xlsx en la zona sube el archivo y muestra el mensaje de éxito", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockResponse({
        ok: true,
        status: 200,
        body: { success: true, count: 7, priceParseErrors: [] },
      }),
    );

    render(<UploadDropzone />);
    const dropzone = screen.getByTestId("upload-dropzone");
    const file = excelFile();

    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });

    expect(await screen.findByText("¡Éxito! Se cargaron 7 propiedades.")).toBeInTheDocument();
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("/api/upload");
    expect(init.method).toBe("POST");
  });

  it("elegir un archivo por el input sube el archivo (change event)", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockResponse({
        ok: true,
        status: 200,
        body: { success: true, count: 3, priceParseErrors: [] },
      }),
    );

    render(<UploadDropzone />);
    const input = screen.getByTestId("upload-file-input") as HTMLInputElement;

    fireEvent.change(input, { target: { files: [excelFile()] } });

    expect(await screen.findByText("¡Éxito! Se cargaron 3 propiedades.")).toBeInTheDocument();
  });

  it("un archivo con extensión no permitida muestra el error sin llamar a fetch", () => {
    global.fetch = jest.fn();
    render(<UploadDropzone />);
    const input = screen.getByTestId("upload-file-input") as HTMLInputElement;

    fireEvent.change(input, { target: { files: [new File(["x"], "cartera.csv")] } });

    expect(
      screen.getByText("Solo se permiten archivos Excel (.xlsx)."),
    ).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("muestra el error del backend si la subida falla", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockResponse({ ok: false, status: 500, body: { error: "Error interno al procesar el archivo." } }),
    );

    render(<UploadDropzone />);
    const input = screen.getByTestId("upload-file-input") as HTMLInputElement;

    fireEvent.change(input, { target: { files: [excelFile()] } });

    expect(await screen.findByText("Error interno al procesar el archivo.")).toBeInTheDocument();
  });

  it("muestra el aviso de mapeo pendiente cuando el backend responde requiresMappingConfirmation", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockResponse({
        ok: true,
        status: 200,
        body: {
          requiresMappingConfirmation: true,
          sheets: [
            {
              sheetName: "Hoja1",
              headers: ["Dirección"],
              headerSignature: "dirección",
              source: "heuristic",
              fields: [],
              unresolvedRequiredFields: ["precio"],
              ambiguousFields: [],
            },
          ],
        },
      }),
    );

    render(<UploadDropzone />);
    const input = screen.getByTestId("upload-file-input") as HTMLInputElement;

    fireEvent.change(input, { target: { files: [excelFile()] } });

    expect(
      await screen.findByText(
        "Necesitamos que confirmes el mapeo de columnas antes de cargar el archivo (1 hoja pendiente).",
      ),
    ).toBeInTheDocument();
  });

  it("\"Subir otro archivo\" reinicia el estado a idle tras un resultado", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockResponse({
        ok: true,
        status: 200,
        body: { success: true, count: 1, priceParseErrors: [] },
      }),
    );

    render(<UploadDropzone />);
    fireEvent.change(screen.getByTestId("upload-file-input"), {
      target: { files: [excelFile()] },
    });

    fireEvent.click(await screen.findByRole("button", { name: "Subir otro archivo" }));

    expect(
      screen.getByText("Soltá el archivo acá o hacé click para elegirlo (.xlsx)"),
    ).toBeInTheDocument();
  });
});
