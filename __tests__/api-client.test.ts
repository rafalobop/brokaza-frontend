import { apiClient, ApiError } from "@/lib/api-client";

function mockResponse(init: {
  ok: boolean;
  status: number;
  body?: string;
}): Response {
  return {
    ok: init.ok,
    status: init.status,
    text: async () => init.body ?? "",
  } as Response;
}

describe("apiClient (KAN-155)", () => {
  const originalFetch = global.fetch;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    global.fetch = originalFetch;
    consoleErrorSpy.mockRestore();
  });

  it("devuelve el body parseado en una respuesta 2xx (semántica de apiFetch)", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        mockResponse({ ok: true, status: 200, body: JSON.stringify({ hello: "world" }) }),
      );

    const result = await apiClient<{ hello: string }>("/api/ping");

    expect(result).toEqual({ hello: "world" });
  });

  it("tolera una respuesta 2xx sin body (ej. 204), devolviendo null", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(mockResponse({ ok: true, status: 204, body: "" }));

    const result = await apiClient("/api/logout", { method: "POST" });

    expect(result).toBeNull();
  });

  it("lanza ApiError kind=http usando body.error cuando la respuesta no es 2xx", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockResponse({
        ok: false,
        status: 400,
        body: JSON.stringify({ error: "Email inválido" }),
      }),
    );

    await expect(apiClient("/api/profile")).rejects.toMatchObject({
      name: "ApiError",
      kind: "http",
      status: 400,
      message: "Email inválido",
    });
  });

  it("usa `Error <status>` como fallback cuando la respuesta de error no trae body.error", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(mockResponse({ ok: false, status: 500, body: "" }));

    await expect(apiClient("/api/matches")).rejects.toMatchObject({
      kind: "http",
      status: 500,
      message: "Error 500",
    });
  });

  it("lanza ApiError kind=timeout con el mensaje amigable de fetchWithTimeout si se excede timeoutMs", async () => {
    global.fetch = jest.fn(
      (_input: RequestInfo | URL, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("The operation was aborted.", "AbortError"));
          });
        }),
    );

    await expect(
      apiClient("/api/slow", { timeoutMs: 20, logTag: "[TEST]" }),
    ).rejects.toMatchObject({
      kind: "timeout",
      message: "El servidor no respondió a tiempo. Probá de nuevo en unos segundos.",
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("[TEST]"),
    );
  });

  it("lanza ApiError kind=network y loguea con logTag ante un error de conexión", async () => {
    global.fetch = jest
      .fn()
      .mockRejectedValue(new TypeError("Failed to fetch"));

    await expect(
      apiClient("/api/whoami", { logTag: "[NET]" }),
    ).rejects.toMatchObject({ kind: "network", message: "Failed to fetch" });

    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("[NET]"),
      "TypeError",
      "Failed to fetch",
    );
  });

  it("lanza ApiError kind=validation sin llamar a fetch si el path no empieza con '/'", async () => {
    global.fetch = jest.fn();

    await expect(apiClient("api/profile")).rejects.toMatchObject({
      kind: "validation",
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("fuerza Content-Type: application/json por default, pero permite override del caller", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(mockResponse({ ok: true, status: 200, body: "null" }));
    global.fetch = fetchMock;

    await apiClient("/api/profile", {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
    });

    const [, init] = fetchMock.mock.calls[0];
    expect((init.headers as Record<string, string>)["Content-Type"]).toBe(
      "text/plain",
    );
  });

  it("no fuerza Content-Type cuando el body es FormData (ej. subida de archivos)", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(mockResponse({ ok: true, status: 200, body: "null" }));
    global.fetch = fetchMock;

    const formData = new FormData();
    formData.append("file", new Blob(["contenido"]), "propiedades.xlsx");

    await apiClient("/api/upload", { method: "POST", body: formData });

    const [, init] = fetchMock.mock.calls[0];
    expect(
      (init.headers as Record<string, string>)["Content-Type"],
    ).toBeUndefined();
  });

  it("ApiError es instancia de Error (compatible con catch estándar)", async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(mockResponse({ ok: false, status: 404, body: "" }));

    await expect(apiClient("/api/nope")).rejects.toBeInstanceOf(ApiError);
    await expect(apiClient("/api/nope")).rejects.toBeInstanceOf(Error);
  });
});
