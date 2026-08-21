import { registerServiceWorker } from "@/service-worker/register";

describe("registerServiceWorker (KAN-257)", () => {
  const originalServiceWorker = (navigator as unknown as { serviceWorker?: unknown }).serviceWorker;

  afterEach(() => {
    Object.defineProperty(navigator, "serviceWorker", {
      value: originalServiceWorker,
      configurable: true,
    });
  });

  it("devuelve null si el navegador no soporta Service Worker", async () => {
    // @ts-expect-error -- simula un navegador sin la propiedad (no solo `undefined`)
    delete navigator.serviceWorker;

    await expect(registerServiceWorker()).resolves.toBeNull();
  });

  it("registra el SW en la URL default (/sw.js) y devuelve el registro", async () => {
    const register = jest.fn().mockResolvedValue({ scope: "/" });
    Object.defineProperty(navigator, "serviceWorker", { value: { register }, configurable: true });

    const result = await registerServiceWorker();

    expect(register).toHaveBeenCalledWith("/sw.js");
    expect(result).toEqual({ scope: "/" });
  });

  it("acepta una URL custom", async () => {
    const register = jest.fn().mockResolvedValue({ scope: "/" });
    Object.defineProperty(navigator, "serviceWorker", { value: { register }, configurable: true });

    await registerServiceWorker("/custom-sw.js");

    expect(register).toHaveBeenCalledWith("/custom-sw.js");
  });

  it("devuelve null y loguea si el registro tira", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    const register = jest.fn().mockRejectedValue(new Error("boom"));
    Object.defineProperty(navigator, "serviceWorker", { value: { register }, configurable: true });

    const result = await registerServiceWorker();

    expect(result).toBeNull();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });
});
