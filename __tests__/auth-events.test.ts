import { emitUnauthorized, onUnauthorized } from "@/lib/auth-events";

describe("auth-events (KAN-162)", () => {
  it("emitir sin suscriptores no rompe", () => {
    expect(() => emitUnauthorized()).not.toThrow();
  });

  it("notifica a un suscriptor", () => {
    const listener = jest.fn();
    const unsubscribe = onUnauthorized(listener);

    emitUnauthorized();

    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("notifica a múltiples suscriptores", () => {
    const a = jest.fn();
    const b = jest.fn();
    const unsubA = onUnauthorized(a);
    const unsubB = onUnauthorized(b);

    emitUnauthorized();

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    unsubA();
    unsubB();
  });

  it("unsubscribe deja de recibir eventos", () => {
    const listener = jest.fn();
    const unsubscribe = onUnauthorized(listener);
    unsubscribe();

    emitUnauthorized();

    expect(listener).not.toHaveBeenCalled();
  });
});
