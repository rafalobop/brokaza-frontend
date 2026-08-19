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

  it("muestra el aviso de precios no reconocidos cuando priceParseErrors no está vacío (KAN-219, §8)", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockResponse({
        ok: true,
        status: 200,
        body: {
          success: true,
          count: 10,
          priceParseErrors: [{ address: "Calle Falsa 123", rawValue: "a convenir" }],
        },
      }),
    );

    render(<UploadDropzone />);
    fireEvent.drop(screen.getByTestId("upload-dropzone"), {
      dataTransfer: { files: [excelFile()] },
    });

    expect(
      await screen.findByText(
        "Se cargaron 10 propiedades. 1 con precio no reconocido (se cargaron sin precio).",
      ),
    ).toBeInTheDocument();
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

  describe("modal de confirmación de mapeo (KAN-217)", () => {
    const PENDING_SHEET = {
      sheetName: "Hoja1",
      headers: ["Dirección", "Costo"],
      headerSignature: "costo|dirección",
      source: "heuristic" as const,
      fields: [
        { field: "domicilio", header: "Dirección", confidence: 1, ambiguous: false, candidates: [] },
        { field: "precio", header: null, confidence: 0, ambiguous: false, candidates: [] },
      ],
      unresolvedRequiredFields: ["precio"],
      ambiguousFields: [],
    };
    const MAPPING_FIELDS_BODY = {
      version: 1,
      fields: ["domicilio", "precio"],
      required: ["domicilio", "precio"],
    };

    it("\"Revisar mapeo\" abre el modal; no se abre solo", async () => {
      global.fetch = jest.fn().mockResolvedValueOnce(
        mockResponse({
          ok: true,
          status: 200,
          body: { requiresMappingConfirmation: true, sheets: [PENDING_SHEET] },
        }),
      );

      render(<UploadDropzone />);
      fireEvent.change(screen.getByTestId("upload-file-input"), {
        target: { files: [excelFile()] },
      });

      await screen.findByRole("button", { name: "Revisar mapeo" });
      expect(screen.queryByText("Confirmar mapeo de columnas")).not.toBeInTheDocument();

      global.fetch = jest
        .fn()
        .mockResolvedValue(mockResponse({ ok: true, status: 200, body: MAPPING_FIELDS_BODY }));
      fireEvent.click(screen.getByRole("button", { name: "Revisar mapeo" }));

      expect(await screen.findByText("Confirmar mapeo de columnas")).toBeInTheDocument();
    });

    it("confirmar el mapeo desde el modal sube el archivo con POST /api/upload/confirm-mapping y cierra el modal al éxito", async () => {
      const fetchMock = jest.fn();
      global.fetch = fetchMock;
      fetchMock.mockResolvedValueOnce(
        mockResponse({
          ok: true,
          status: 200,
          body: { requiresMappingConfirmation: true, sheets: [PENDING_SHEET] },
        }),
      );

      render(<UploadDropzone />);
      fireEvent.change(screen.getByTestId("upload-file-input"), {
        target: { files: [excelFile()] },
      });

      fetchMock.mockResolvedValueOnce(
        mockResponse({ ok: true, status: 200, body: MAPPING_FIELDS_BODY }),
      );
      fireEvent.click(await screen.findByRole("button", { name: "Revisar mapeo" }));
      await screen.findByText("Confirmar mapeo de columnas");
      await screen.findByText("Precio");

      const selects = screen.getAllByRole("combobox");
      fireEvent.change(selects[1], { target: { value: "Costo" } });

      fetchMock.mockResolvedValueOnce(
        mockResponse({ ok: true, status: 200, body: { success: true, count: 4, priceParseErrors: [] } }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Confirmar y cargar" }));

      expect(await screen.findByText("¡Éxito! Se cargaron 4 propiedades.")).toBeInTheDocument();
      expect(screen.queryByText("Confirmar mapeo de columnas")).not.toBeInTheDocument();

      const [url, init] = fetchMock.mock.calls[2];
      expect(url).toBe("/api/upload/confirm-mapping");
      expect((init.body as FormData).get("mappings")).toBe(
        JSON.stringify({ Hoja1: { domicilio: "Dirección", precio: "Costo" } }),
      );
    });

    it("cancelar el modal vuelve la zona de subida a idle", async () => {
      const fetchMock = jest.fn();
      global.fetch = fetchMock;
      fetchMock.mockResolvedValueOnce(
        mockResponse({
          ok: true,
          status: 200,
          body: { requiresMappingConfirmation: true, sheets: [PENDING_SHEET] },
        }),
      );

      render(<UploadDropzone />);
      fireEvent.change(screen.getByTestId("upload-file-input"), {
        target: { files: [excelFile()] },
      });

      fetchMock.mockResolvedValueOnce(
        mockResponse({ ok: true, status: 200, body: MAPPING_FIELDS_BODY }),
      );
      fireEvent.click(await screen.findByRole("button", { name: "Revisar mapeo" }));
      await screen.findByText("Confirmar mapeo de columnas");

      fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));

      expect(screen.queryByText("Confirmar mapeo de columnas")).not.toBeInTheDocument();
      expect(
        screen.getByText("Soltá el archivo acá o hacé click para elegirlo (.xlsx)"),
      ).toBeInTheDocument();
    });
  });
});
