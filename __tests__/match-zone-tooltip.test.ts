import { isZoneMatchReason, ZONE_MATCH_REASON_PREFIX } from "@/lib/match-zone-tooltip";

describe("isZoneMatchReason (KAN-189, port de KAN-92)", () => {
  it("matchea un reason que empieza con el prefijo exacto", () => {
    expect(isZoneMatchReason(`${ZONE_MATCH_REASON_PREFIX} en Barrio Sur`)).toBe(true);
  });

  it("no matchea un reason que no tiene el prefijo", () => {
    expect(isZoneMatchReason("Coincidencia de Precio")).toBe(false);
  });

  it("no matchea un reason vacío", () => {
    expect(isZoneMatchReason("")).toBe(false);
  });

  it("no tira excepción ante valores no-string (AC: manejo de errores adecuado)", () => {
    expect(() => isZoneMatchReason(null)).not.toThrow();
    expect(() => isZoneMatchReason(undefined)).not.toThrow();
    expect(() => isZoneMatchReason(42)).not.toThrow();
    expect(() => isZoneMatchReason({ text: ZONE_MATCH_REASON_PREFIX })).not.toThrow();

    expect(isZoneMatchReason(null)).toBe(false);
    expect(isZoneMatchReason(undefined)).toBe(false);
    expect(isZoneMatchReason(42)).toBe(false);
  });
});
