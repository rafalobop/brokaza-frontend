import { act, fireEvent, render, screen } from "@testing-library/react";
import { UploadDropzone } from "@/components/upload/UploadDropzone";

/** Mismo mock mínimo que `use-upload-progress.test.ts` (KAN-187/338). */
class MockWebSocket {
  static OPEN = 1;
  static CONNECTING = 0;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;
  listeners: Record<string, Array<(event: unknown) => void>> = {};
  closed = false;

  constructor(url: string) {
    this.url = url;
    mockSockets.push(this);
  }

  addEventListener(type: string, listener: (event: unknown) => void) {
    (this.listeners[type] ??= []).push(listener);
  }

  removeEventListener(type: string, listener: (event: unknown) => void) {
    this.listeners[type] = (this.listeners[type] ?? []).filter((l) => l !== listener);
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    this.closed = true;
  }

  emit(type: string, event: unknown) {
    (this.listeners[type] ?? []).forEach((listener) => listener(event));
  }
}

let mockSockets: MockWebSocket[] = [];

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

// KAN-338: el resultado final de la subida ya no viaja en la respuesta HTTP — llega por el
// último socket WS abierto, en la etapa 'done'. Helper para no repetir el JSON.stringify en
// cada test que espera el mensaje de éxito.
async function emitLatestSocketDone(doneResult: Record<string, unknown>) {
  const socket = mockSockets[mockSockets.length - 1];
  await act(async () => {
    socket.emit("message", {
      data: JSON.stringify({ type: "upload_status", stage: "done", ...doneResult }),
    });
  });
}

describe("UploadDropzone (KAN-216/338)", () => {
  const originalFetch = global.fetch;
  const originalWebSocket = global.WebSocket;

  beforeEach(() => {
    mockSockets = [];
    // @ts-expect-error -- mock deliberado del WebSocket global, mismo criterio que KAN-187
    global.WebSocket = MockWebSocket;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    global.WebSocket = originalWebSocket;
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

  it("soltar un .xlsx en la zona sube el archivo y muestra el mensaje de éxito cuando llega 'done' por WS (KAN-338)", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockResponse({
        ok: true,
        status: 202,
        body: { accepted: true, message: "Tu cartera se está sincronizando." },
      }),
    );

    render(<UploadDropzone />);
    const dropzone = screen.getByTestId("upload-dropzone");
    const file = excelFile();

    fireEvent.drop(dropzone, { dataTransfer: { files: [file] } });

    await emitLatestSocketDone({ count: 7, priceParseErrors: [], loaded: [], failed: [] });

    expect(await screen.findByText("¡Listo! Se cargaron 7 propiedades.")).toBeInTheDocument();
    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe("/api/upload");
    expect(init.method).toBe("POST");
  });

  it("abre automáticamente el modal de resultado con el detalle (hoja, dirección, motivo) de lo que no se cargó bien (KAN-220)", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockResponse({
        ok: true,
        status: 202,
        body: { accepted: true, message: "Tu cartera se está sincronizando." },
      }),
    );

    render(<UploadDropzone />);
    fireEvent.drop(screen.getByTestId("upload-dropzone"), {
      dataTransfer: { files: [excelFile()] },
    });

    await emitLatestSocketDone({
      count: 10,
      priceParseErrors: [
        { sheetName: "Ventas", address: "Calle Falsa 123", rawValue: "a convenir" },
      ],
      loaded: [],
      failed: [
        {
          sheetName: "Ventas",
          address: "Calle Falsa 123",
          reason: 'Precio no reconocido ("a convenir"), se cargó sin precio.',
        },
      ],
    });

    expect(
      await screen.findByText("¡Listo! Se cargaron 10 propiedades, 1 con problemas."),
    ).toBeInTheDocument();
    expect(await screen.findByText("Resultado de la carga")).toBeInTheDocument();
    expect(screen.getByText("Calle Falsa 123")).toBeInTheDocument();
    expect(
      screen.getByText('Precio no reconocido ("a convenir"), se cargó sin precio.'),
    ).toBeInTheDocument();
  });

  it("elegir un archivo por el input sube el archivo (change event)", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockResponse({
        ok: true,
        status: 202,
        body: { accepted: true, message: "Tu cartera se está sincronizando." },
      }),
    );

    render(<UploadDropzone />);
    const input = screen.getByTestId("upload-file-input") as HTMLInputElement;

    fireEvent.change(input, { target: { files: [excelFile()] } });
    await emitLatestSocketDone({ count: 3, priceParseErrors: [], loaded: [], failed: [] });

    expect(await screen.findByText("¡Listo! Se cargaron 3 propiedades.")).toBeInTheDocument();
  });

  it("un archivo con extensión no permitida muestra el error sin llamar a fetch", () => {
    global.fetch = jest.fn();
    render(<UploadDropzone />);
    const input = screen.getByTestId("upload-file-input") as HTMLInputElement;

    fireEvent.change(input, { target: { files: [new File(["x"], "cartera.csv")] } });

    expect(screen.getByText("Solo se permiten archivos Excel (.xlsx).")).toBeInTheDocument();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("muestra el error del backend si la subida falla", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockResponse({
        ok: false,
        status: 500,
        body: { error: "Error interno al procesar el archivo." },
      }),
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

  it('"Subir otro archivo" reinicia el estado a idle tras un resultado', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockResponse({
        ok: true,
        status: 202,
        body: { accepted: true, message: "Tu cartera se está sincronizando." },
      }),
    );

    render(<UploadDropzone />);
    fireEvent.change(screen.getByTestId("upload-file-input"), {
      target: { files: [excelFile()] },
    });
    await emitLatestSocketDone({ count: 1, priceParseErrors: [], loaded: [], failed: [] });

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
        {
          field: "domicilio",
          header: "Dirección",
          confidence: 1,
          ambiguous: false,
          candidates: [],
        },
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

    it('"Revisar mapeo" abre el modal; no se abre solo', async () => {
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

      fireEvent.click(screen.getByRole("button", { name: "Precio — Hoja1" }));
      fireEvent.click(screen.getByRole("button", { name: "Costo" }));

      fetchMock.mockResolvedValueOnce(
        mockResponse({
          ok: true,
          status: 202,
          body: { accepted: true, message: "Tu cartera se está sincronizando." },
        }),
      );
      fireEvent.click(screen.getByRole("button", { name: "Confirmar y cargar" }));
      await emitLatestSocketDone({ count: 4, priceParseErrors: [], loaded: [], failed: [] });

      expect(await screen.findByText("¡Listo! Se cargaron 4 propiedades.")).toBeInTheDocument();
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
