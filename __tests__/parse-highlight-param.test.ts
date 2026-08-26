import { parseHighlightIds } from "@/lib/parse-highlight-param";

describe("parseHighlightIds (KAN-303)", () => {
  it("un solo id", () => {
    expect(parseHighlightIds("match-abc")).toEqual(["match-abc"]);
  });

  it("varios ids separados por coma", () => {
    expect(parseHighlightIds("match-1,match-2")).toEqual(["match-1", "match-2"]);
  });

  it("null (sin query param) devuelve array vacío", () => {
    expect(parseHighlightIds(null)).toEqual([]);
  });

  it("string vacío devuelve array vacío", () => {
    expect(parseHighlightIds("")).toEqual([]);
  });

  it("filtra segmentos vacíos de comas de más (defensivo ante un backend con un bug de join)", () => {
    expect(parseHighlightIds("match-1,,match-2")).toEqual(["match-1", "match-2"]);
  });
});
