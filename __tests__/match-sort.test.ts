import { paginateMatches, sortMatches } from "@/lib/match-sort";
import type { Match } from "@/lib/matches-api";

function buildMatch(overrides: Partial<Match>): Match {
  return {
    id: "1",
    fecha: "2026-01-01",
    searchText: "texto",
    property: { domicilio: "Calle Falsa 123", precio: 1000, moneda: "USD", operacion: "alquiler" },
    reasons: [],
    score: 50,
    userReviewStatus: "PENDING",
    feedbackReason: null,
    ...overrides,
  };
}

describe("sortMatches (KAN-189, port de loadMatches sort)", () => {
  const matches = [
    buildMatch({ id: "a", score: 50 }),
    buildMatch({ id: "b", score: 90 }),
    buildMatch({ id: "c", score: 10 }),
  ];

  it("fecha-desc no reordena (orden nativo, ya viene desc del backend)", () => {
    expect(sortMatches(matches, "fecha-desc").map((m) => m.id)).toEqual(["a", "b", "c"]);
  });

  it("fecha-asc invierte el orden", () => {
    expect(sortMatches(matches, "fecha-asc").map((m) => m.id)).toEqual(["c", "b", "a"]);
  });

  it("score-desc ordena por score descendente", () => {
    expect(sortMatches(matches, "score-desc").map((m) => m.id)).toEqual(["b", "a", "c"]);
  });

  it("score-asc ordena por score ascendente", () => {
    expect(sortMatches(matches, "score-asc").map((m) => m.id)).toEqual(["c", "a", "b"]);
  });

  it("no muta el array original", () => {
    const original = [...matches];
    sortMatches(matches, "score-desc");
    expect(matches).toEqual(original);
  });
});

describe("paginateMatches (KAN-189, port de la paginación de loadMatches)", () => {
  const matches = Array.from({ length: 25 }, (_, i) => buildMatch({ id: `m${i}` }));

  it("pagina de a 10 por default", () => {
    const page1 = paginateMatches(matches, 1, 10);
    expect(page1.items).toHaveLength(10);
    expect(page1.items[0].id).toBe("m0");
    expect(page1.totalPages).toBe(3);
    expect(page1.startIndex).toBe(0);
    expect(page1.endIndex).toBe(10);
  });

  it("devuelve la última página parcial", () => {
    const page3 = paginateMatches(matches, 3, 10);
    expect(page3.items).toHaveLength(5);
    expect(page3.startIndex).toBe(20);
    expect(page3.endIndex).toBe(25);
  });

  it("clampea una página pedida por debajo de 1", () => {
    const page = paginateMatches(matches, 0, 10);
    expect(page.currentPage).toBe(1);
  });

  it("clampea una página pedida por encima del total", () => {
    const page = paginateMatches(matches, 99, 10);
    expect(page.currentPage).toBe(3);
  });

  it("con lista vacía devuelve totalPages=1 y currentPage=1", () => {
    const page = paginateMatches([], 1, 10);
    expect(page.totalPages).toBe(1);
    expect(page.currentPage).toBe(1);
    expect(page.items).toEqual([]);
    expect(page.total).toBe(0);
  });
});
