import { buildSearchSummary, SEARCH_STATUS_LABELS } from "@/lib/active-search-summary";

describe("buildSearchSummary (KAN-191, port de app.js)", () => {
  it("devuelve un mensaje fijo si no hay criterios", () => {
    expect(buildSearchSummary(null)).toBe("Búsqueda sin criterios detectados.");
  });

  it("arma el resumen completo con todos los campos", () => {
    const summary = buildSearchSummary({
      operation: "alquiler",
      property_type: "departamento",
      zones: ["Barrio Sur", "Centro"],
      bedrooms: 2,
      max_budget: 300,
      currency: "USD",
    });
    expect(summary).toBe(
      "Alquiler · departamento · en Barrio Sur, Centro · 2 dorm. · hasta USD 300",
    );
  });

  it("usa 'Operación sin especificar' para operation desconocida o ausente", () => {
    expect(buildSearchSummary({ operation: "desconocido" })).toBe("Operación sin especificar");
    expect(buildSearchSummary({})).toBe("Operación sin especificar");
  });

  it("omite el presupuesto si currency es 'desconocido'", () => {
    const summary = buildSearchSummary({
      operation: "venta",
      max_budget: 100000,
      currency: "desconocido",
    });
    expect(summary).toBe("Venta");
  });

  it("omite zonas/dormitorios/presupuesto si no vienen", () => {
    expect(buildSearchSummary({ operation: "venta" })).toBe("Venta");
  });
});

describe("SEARCH_STATUS_LABELS", () => {
  it("tiene labels para active y expired", () => {
    expect(SEARCH_STATUS_LABELS.active).toBe("Activa");
    expect(SEARCH_STATUS_LABELS.expired).toBe("Vencida");
  });
});
