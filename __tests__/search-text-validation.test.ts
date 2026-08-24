import { MAX_SEARCH_TEXT_LENGTH, stripSearchControlChars } from "@/lib/search-text-validation";

describe("stripSearchControlChars (KAN-191, port de app.js)", () => {
  it("deja pasar texto normal sin cambios", () => {
    expect(stripSearchControlChars("Busco depto 2 dorm")).toBe("Busco depto 2 dorm");
  });

  it("preserva \\n y \\r", () => {
    expect(stripSearchControlChars("linea1\nlinea2\r\n")).toBe("linea1\nlinea2\r\n");
  });

  it("remueve otros caracteres de control", () => {
    expect(stripSearchControlChars("texto\x00con\x07control\x1F")).toBe("textoconcontrol");
  });
});

describe("MAX_SEARCH_TEXT_LENGTH", () => {
  it("es 200, igual que el backend", () => {
    expect(MAX_SEARCH_TEXT_LENGTH).toBe(200);
  });
});
