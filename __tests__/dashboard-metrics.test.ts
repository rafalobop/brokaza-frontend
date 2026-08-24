import {
  buildSnapshot,
  createState,
  recordPollTick,
  recordReconnectAttempt,
  recordRefetchDuration,
  recordSocketClose,
  recordSocketOpen,
  resetWindow,
} from "@/lib/dashboard-metrics";

describe("dashboard-metrics (KAN-187, port de metrics.js)", () => {
  it("crea un estado inicial en cero", () => {
    const state = createState();
    expect(state.socketOpens).toBe(0);
    expect(state.socketCloses).toBe(0);
    expect(state.reconnectAttempts).toBe(0);
    expect(state.refetchDurationsMs).toEqual([]);
    expect(state.pollTicksWhileSocketUp).toBe(0);
    expect(state.pollTicksWhileSocketDown).toBe(0);
  });

  it("registra aperturas, cierres y reintentos del socket", () => {
    const state = createState();
    recordSocketOpen(state);
    recordSocketOpen(state);
    recordSocketClose(state);
    recordReconnectAttempt(state);

    const snapshot = buildSnapshot(state, state.windowStartedAt);
    expect(snapshot.socketOpens).toBe(2);
    expect(snapshot.socketCloses).toBe(1);
    expect(snapshot.reconnectAttempts).toBe(1);
  });

  it("ignora duraciones de refetch inválidas (negativas, NaN, no-numéricas)", () => {
    const state = createState();
    recordRefetchDuration(state, -5);
    recordRefetchDuration(state, NaN);
    // @ts-expect-error -- valor deliberadamente inválido para el test
    recordRefetchDuration(state, "100");

    expect(state.refetchDurationsMs).toEqual([]);
  });

  it("acota las muestras de refetch a las últimas 50", () => {
    const state = createState();
    for (let i = 0; i < 60; i++) {
      recordRefetchDuration(state, i);
    }
    expect(state.refetchDurationsMs).toHaveLength(50);
    // Se descartan las más viejas (FIFO) — deben quedar 10..59
    expect(state.refetchDurationsMs[0]).toBe(10);
  });

  it("calcula avg y p95 de las duraciones de refetch", () => {
    const state = createState();
    [100, 200, 300, 400, 500].forEach((d) => recordRefetchDuration(state, d));

    const snapshot = buildSnapshot(state, state.windowStartedAt);
    expect(snapshot.refetchSampleCount).toBe(5);
    expect(snapshot.avgRefetchDurationMs).toBe(300);
    expect(snapshot.p95RefetchDurationMs).toBe(500);
  });

  it("devuelve avg/p95 en cero cuando no hay muestras", () => {
    const state = createState();
    const snapshot = buildSnapshot(state, state.windowStartedAt);
    expect(snapshot.avgRefetchDurationMs).toBe(0);
    expect(snapshot.p95RefetchDurationMs).toBe(0);
  });

  it("distingue poll ticks con el socket arriba vs. abajo", () => {
    const state = createState();
    recordPollTick(state, true);
    recordPollTick(state, true);
    recordPollTick(state, false);

    const snapshot = buildSnapshot(state, state.windowStartedAt);
    expect(snapshot.pollTicksWhileSocketUp).toBe(2);
    expect(snapshot.pollTicksWhileSocketDown).toBe(1);
  });

  it("windowMs refleja el tiempo transcurrido desde windowStartedAt", () => {
    const state = createState();
    const snapshot = buildSnapshot(state, state.windowStartedAt + 5000);
    expect(snapshot.windowMs).toBe(5000);
  });

  it("resetWindow conserva la referencia del estado y limpia los contadores", () => {
    const state = createState();
    recordSocketOpen(state);
    recordRefetchDuration(state, 100);
    recordPollTick(state, true);

    const now = state.windowStartedAt + 10000;
    resetWindow(state, now);

    expect(state.windowStartedAt).toBe(now);
    expect(state.socketOpens).toBe(0);
    expect(state.refetchDurationsMs).toEqual([]);
    expect(state.pollTicksWhileSocketUp).toBe(0);
  });
});
