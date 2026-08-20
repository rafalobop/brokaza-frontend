import { getProperties } from "@/lib/properties-api";

function mockResponse(init: { ok: boolean; status: number; body?: unknown }): Response {
  return {
    ok: init.ok,
    status: init.status,
    text: async () => (init.body !== undefined ? JSON.stringify(init.body) : ""),
  } as Response;
}

describe("getProperties (KAN-240)", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("pega a /admin/api/properties?page=1 por default", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        mockResponse({
          ok: true,
          status: 200,
          body: { properties: [], page: 1, pageSize: 50, total: 0 },
        }),
      );
    global.fetch = fetchMock;

    await getProperties();

    expect(fetchMock).toHaveBeenCalledWith(
      "/admin/api/properties?page=1",
      expect.objectContaining({}),
    );
  });

  it("incluye search en el query string cuando se pasa", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        mockResponse({
          ok: true,
          status: 200,
          body: { properties: [], page: 2, pageSize: 50, total: 0 },
        }),
      );
    global.fetch = fetchMock;

    await getProperties({ page: 2, search: "Falsa 123" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/admin/api/properties?page=2&search=Falsa+123",
      expect.objectContaining({}),
    );
  });

  it("no agrega search al query string cuando está vacío", async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValue(
        mockResponse({
          ok: true,
          status: 200,
          body: { properties: [], page: 1, pageSize: 50, total: 0 },
        }),
      );
    global.fetch = fetchMock;

    await getProperties({ search: "" });

    expect(fetchMock).toHaveBeenCalledWith(
      "/admin/api/properties?page=1",
      expect.objectContaining({}),
    );
  });
});
