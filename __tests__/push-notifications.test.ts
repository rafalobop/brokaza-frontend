import {
  fetchVapidPublicKey,
  isPushSupported,
  logPushIssue,
  PushSubscriptionError,
  sendSubscriptionToBackend,
  urlBase64ToUint8Array,
} from "@/lib/push-notifications";

function mockResponse(init: { ok: boolean; status: number; body?: string }): Response {
  return { ok: init.ok, status: init.status, text: async () => init.body ?? "" } as Response;
}

describe("push-notifications (KAN-257)", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  describe("isPushSupported", () => {
    it("true si serviceWorker y PushManager están disponibles", () => {
      Object.defineProperty(navigator, "serviceWorker", { value: {}, configurable: true });
      (window as unknown as { PushManager: unknown }).PushManager = function () {};

      expect(isPushSupported()).toBe(true);

      // @ts-expect-error -- limpieza
      delete navigator.serviceWorker;
      // @ts-expect-error -- limpieza
      delete window.PushManager;
    });

    it("false sin soporte de push (ej. iOS Safari fuera de una PWA instalada)", () => {
      // @ts-expect-error -- simula ausencia real de la propiedad
      delete navigator.serviceWorker;
      // @ts-expect-error -- limpieza
      delete window.PushManager;

      expect(isPushSupported()).toBe(false);
    });
  });

  describe("urlBase64ToUint8Array", () => {
    it("decodifica una clave VAPID base64url sin padding", () => {
      // "hola" en base64 estándar es "aG9sYQ==" -> base64url sin padding: "aG9sYQ"
      const result = urlBase64ToUint8Array("aG9sYQ");
      const decoded = String.fromCharCode(...Array.from(result));
      expect(decoded).toBe("hola");
    });
  });

  describe("fetchVapidPublicKey", () => {
    it("devuelve la publicKey del backend", async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue(
          mockResponse({ ok: true, status: 200, body: JSON.stringify({ publicKey: "abc123" }) }),
        );

      await expect(fetchVapidPublicKey()).resolves.toBe("abc123");
    });

    it("lanza PushSubscriptionError(vapid_key_fetch_failed) si el backend falla", async () => {
      global.fetch = jest.fn().mockResolvedValue(mockResponse({ ok: false, status: 500 }));

      await expect(fetchVapidPublicKey()).rejects.toMatchObject({
        category: "vapid_key_fetch_failed",
      });
    });
  });

  describe("sendSubscriptionToBackend", () => {
    it("resuelve sin error si el backend acepta la suscripción", async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValue(mockResponse({ ok: true, status: 200, body: "{}" }));

      await expect(
        sendSubscriptionToBackend({ endpoint: "https://push.example/1" } as PushSubscription),
      ).resolves.toBeUndefined();
    });

    it("lanza PushSubscriptionError(backend_subscribe_failed) si el backend rechaza", async () => {
      global.fetch = jest.fn().mockResolvedValue(mockResponse({ ok: false, status: 400 }));

      await expect(
        sendSubscriptionToBackend({ endpoint: "https://push.example/1" } as PushSubscription),
      ).rejects.toMatchObject({ category: "backend_subscribe_failed" });
    });
  });

  describe("logPushIssue", () => {
    it("loguea con la categoría como tag estructurado", () => {
      const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});

      logPushIssue("permission_denied", new Error("nope"));

      expect(consoleError).toHaveBeenCalledWith(
        "[PUSH] category=permission_denied",
        expect.any(Error),
      );
    });
  });

  describe("PushSubscriptionError", () => {
    it("expone la categoría y preserva la causa original", () => {
      const cause = new Error("original");
      const error = new PushSubscriptionError("mensaje", "sw_registration_failed", { cause });

      expect(error.category).toBe("sw_registration_failed");
      expect(error.cause).toBe(cause);
      expect(error.name).toBe("PushSubscriptionError");
    });
  });
});
