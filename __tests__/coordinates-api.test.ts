import { updatePropertyCoordinates } from "@/lib/coordinates-api";

function mockResponse(init: { ok: boolean; status: number; body?: unknown }): Response {
  return {
    ok: init.ok,
    status: init.status,
    text: async () => (init.body !== undefined ? JSON.stringify(init.body) : ""),
  } as Response;
}

describe("updatePropertyCoordinates (KAN-242)", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("hace PATCH a /admin/api/properties/:id/coordinates con lat/lng", async () => {
    const fetchMock = jest.fn().mockResolvedValue(
      mockResponse({
        ok: true,
        status: 200,
        body: { success: true, latitude: -26.82, longitude: -65.2, zone: null, zoneSource: "none" },
      }),
    );
    global.fetch = fetchMock;

    await updatePropertyCoordinates("p1", -26.82, -65.2);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/admin/api/properties/p1/coordinates");
    expect(init.method).toBe("PATCH");
    expect(JSON.parse(init.body)).toEqual({ latitude: -26.82, longitude: -65.2 });
  });

  it("propaga el body parseado en éxito", async () => {
    global.fetch = jest.fn().mockResolvedValue(
      mockResponse({
        ok: true,
        status: 200,
        body: {
          success: true,
          latitude: -26.82,
          longitude: -65.2,
          zone: { id: "z1", name: "Barrio Sur", group_id: null },
          zoneSource: "point",
        },
      }),
    );

    const result = await updatePropertyCoordinates("p1", -26.82, -65.2);

    expect(result.zone).toEqual({ id: "z1", name: "Barrio Sur", group_id: null });
    expect(result.zoneSource).toBe("point");
  });
});
