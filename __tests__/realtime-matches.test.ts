import {
  buildMatchCountSocketUrl,
  DEFAULT_MAX_DELAY_MS,
  nextReconnectDelayMs,
  randomIntervalMs,
  shouldRefetchOnMessage,
} from "@/lib/realtime-matches";

describe("realtime-matches (KAN-187, port de realtimeMatches.js)", () => {
  describe("buildMatchCountSocketUrl", () => {
    it("usa wss: cuando el protocolo es https:", () => {
      expect(buildMatchCountSocketUrl({ protocol: "https:", host: "app.brokaza.com" })).toBe(
        "wss://app.brokaza.com/ws",
      );
    });

    it("usa ws: cuando el protocolo no es https:", () => {
      expect(buildMatchCountSocketUrl({ protocol: "http:", host: "localhost:3000" })).toBe(
        "ws://localhost:3000/ws",
      );
    });
  });

  describe("shouldRefetchOnMessage", () => {
    it("devuelve true para el evento match_count_changed", () => {
      expect(shouldRefetchOnMessage(JSON.stringify({ type: "match_count_changed" }))).toBe(true);
    });

    it("devuelve false para otros tipos de evento", () => {
      expect(shouldRefetchOnMessage(JSON.stringify({ type: "other_event" }))).toBe(false);
    });

    it("devuelve false ante JSON inválido", () => {
      expect(shouldRefetchOnMessage("no-es-json")).toBe(false);
    });

    it("devuelve false ante un payload no-string", () => {
      expect(shouldRefetchOnMessage(null)).toBe(false);
      expect(shouldRefetchOnMessage(undefined)).toBe(false);
    });

    it("devuelve false ante un payload JSON válido pero sin type", () => {
      expect(shouldRefetchOnMessage(JSON.stringify({ foo: "bar" }))).toBe(false);
    });
  });

  describe("nextReconnectDelayMs", () => {
    it("duplica el delay actual", () => {
      expect(nextReconnectDelayMs(1000, DEFAULT_MAX_DELAY_MS)).toBe(2000);
    });

    it("no supera el tope máximo", () => {
      expect(nextReconnectDelayMs(10000, DEFAULT_MAX_DELAY_MS)).toBe(DEFAULT_MAX_DELAY_MS);
    });

    it("usa DEFAULT_MAX_DELAY_MS si no se pasa maxDelayMs", () => {
      expect(nextReconnectDelayMs(10000)).toBe(DEFAULT_MAX_DELAY_MS);
    });
  });

  describe("randomIntervalMs", () => {
    it("devuelve un valor dentro de [minMs, maxMs)", () => {
      for (let i = 0; i < 50; i++) {
        const value = randomIntervalMs(15000, 30000);
        expect(value).toBeGreaterThanOrEqual(15000);
        expect(value).toBeLessThan(30000);
      }
    });
  });
});
