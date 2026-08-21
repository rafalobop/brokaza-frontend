import { createActivityTracker } from "@/lib/user-activity";

describe("user-activity (KAN-256)", () => {
  const originalVisibilityState = Object.getOwnPropertyDescriptor(
    Document.prototype,
    "visibilityState",
  );

  afterEach(() => {
    jest.useRealTimers();
    if (originalVisibilityState) {
      Object.defineProperty(document, "visibilityState", originalVisibilityState);
    }
  });

  function setVisibility(state: DocumentVisibilityState): void {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => state,
    });
  }

  it("está activo apenas se crea (cuenta el mount como actividad)", () => {
    const tracker = createActivityTracker();
    expect(tracker.isActive()).toBe(true);
    tracker.destroy();
  });

  it("pasa a inactivo tras el umbral de inactividad sin eventos", () => {
    jest.useFakeTimers();
    const tracker = createActivityTracker(1000);

    jest.advanceTimersByTime(1001);

    expect(tracker.isActive()).toBe(false);
    tracker.destroy();
  });

  it("vuelve a estar activo si hay un evento de interacción", () => {
    jest.useFakeTimers();
    const tracker = createActivityTracker(1000);

    jest.advanceTimersByTime(999);
    window.dispatchEvent(new Event("mousemove"));
    jest.advanceTimersByTime(999);

    expect(tracker.isActive()).toBe(true);
    tracker.destroy();
  });

  it("es inactivo si la pestaña está en background, aunque haya actividad reciente", () => {
    setVisibility("hidden");
    const tracker = createActivityTracker();

    expect(tracker.isActive()).toBe(false);
    tracker.destroy();
  });

  it("destroy() saca los listeners (nuevos eventos ya no cuentan)", () => {
    jest.useFakeTimers();
    const tracker = createActivityTracker(1000);
    tracker.destroy();

    jest.advanceTimersByTime(999);
    window.dispatchEvent(new Event("mousemove"));
    jest.advanceTimersByTime(2);

    expect(tracker.isActive()).toBe(false);
  });
});
