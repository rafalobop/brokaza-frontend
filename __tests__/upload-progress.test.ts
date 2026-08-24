import {
  debounce,
  parseUploadStatusMessage,
  uploadStageProgressPercent,
  UPLOAD_STAGE_LABELS,
} from "@/lib/upload-progress";

describe("upload-progress (KAN-218)", () => {
  describe("parseUploadStatusMessage", () => {
    it.each([
      "parsing_headers",
      "resolving_column_mapping",
      "parsing_rows",
      "syncing_database",
      "done",
      "error",
    ] as const)("reconoce la etapa '%s'", (stage) => {
      expect(parseUploadStatusMessage(JSON.stringify({ type: "upload_status", stage }))).toBe(
        stage,
      );
    });

    it("devuelve null para otros tipos de evento (ej. match_count_changed)", () => {
      expect(parseUploadStatusMessage(JSON.stringify({ type: "match_count_changed" }))).toBeNull();
    });

    it("devuelve null ante una etapa desconocida", () => {
      expect(
        parseUploadStatusMessage(JSON.stringify({ type: "upload_status", stage: "algo_raro" })),
      ).toBeNull();
    });

    it("devuelve null ante JSON inválido", () => {
      expect(parseUploadStatusMessage("no-es-json")).toBeNull();
    });

    it("devuelve null ante un payload no-string", () => {
      expect(parseUploadStatusMessage(null)).toBeNull();
      expect(parseUploadStatusMessage(undefined)).toBeNull();
    });

    it("devuelve null si falta 'stage'", () => {
      expect(parseUploadStatusMessage(JSON.stringify({ type: "upload_status" }))).toBeNull();
    });
  });

  describe("uploadStageProgressPercent", () => {
    it("avanza de forma monótona a través de las 5 etapas del pipeline", () => {
      const percents = [
        "parsing_headers",
        "resolving_column_mapping",
        "parsing_rows",
        "syncing_database",
        "done",
      ].map((stage) => uploadStageProgressPercent(stage as never));

      expect(percents).toEqual([20, 40, 60, 80, 100]);
    });

    it("'error' se muestra al 100% (barra llena, coloreada por el componente)", () => {
      expect(uploadStageProgressPercent("error")).toBe(100);
    });
  });

  describe("UPLOAD_STAGE_LABELS", () => {
    it("tiene una etiqueta para cada una de las 6 etapas del contrato del backend", () => {
      expect(Object.keys(UPLOAD_STAGE_LABELS).sort()).toEqual(
        [
          "parsing_headers",
          "resolving_column_mapping",
          "parsing_rows",
          "syncing_database",
          "done",
          "error",
        ].sort(),
      );
    });
  });

  describe("debounce", () => {
    beforeEach(() => jest.useFakeTimers());
    afterEach(() => jest.useRealTimers());

    it("coalesce llamadas rápidas en una sola, con el último argumento", () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 150);

      debounced("a");
      debounced("b");
      debounced("c");
      expect(fn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(150);
      expect(fn).toHaveBeenCalledTimes(1);
      expect(fn).toHaveBeenCalledWith("c");
    });

    it("cancel() evita que una llamada pendiente se dispare", () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 150);

      debounced("a");
      debounced.cancel();
      jest.advanceTimersByTime(150);

      expect(fn).not.toHaveBeenCalled();
    });

    it("llamadas espaciadas más que el delay disparan una vez cada una", () => {
      const fn = jest.fn();
      const debounced = debounce(fn, 150);

      debounced("a");
      jest.advanceTimersByTime(150);
      debounced("b");
      jest.advanceTimersByTime(150);

      expect(fn).toHaveBeenNthCalledWith(1, "a");
      expect(fn).toHaveBeenNthCalledWith(2, "b");
    });
  });
});
