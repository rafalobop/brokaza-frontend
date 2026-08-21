import { act, renderHook, waitFor } from "@testing-library/react";
import { usePushNotifications } from "@/lib/use-push-notifications";

function mockResponse(init: { ok: boolean; status: number; body?: string }): Response {
  return { ok: init.ok, status: init.status, text: async () => init.body ?? "" } as Response;
}

function mockRegistration(getSubscription: jest.Mock, subscribe: jest.Mock) {
  return {
    pushManager: { getSubscription, subscribe },
  } as unknown as ServiceWorkerRegistration;
}

describe("usePushNotifications (KAN-257)", () => {
  const originalFetch = global.fetch;
  const originalNotification = (global as unknown as { Notification?: unknown }).Notification;

  beforeEach(() => {
    Object.defineProperty(navigator, "serviceWorker", {
      value: { register: jest.fn() },
      configurable: true,
    });
    (window as unknown as { PushManager: unknown }).PushManager = function () {};
  });

  afterEach(() => {
    global.fetch = originalFetch;
    (global as unknown as { Notification?: unknown }).Notification = originalNotification;
    // @ts-expect-error -- limpieza
    delete navigator.serviceWorker;
    // @ts-expect-error -- limpieza
    delete window.PushManager;
    jest.restoreAllMocks();
  });

  it("queda en 'unsupported' si el navegador no soporta push", async () => {
    // @ts-expect-error -- simula falta de soporte
    delete window.PushManager;

    const { result } = renderHook(() => usePushNotifications({ enabled: true }));

    await waitFor(() => expect(result.current.status).toBe("unsupported"));
  });

  it("no hace nada mientras enabled=false", async () => {
    const register = jest.fn();
    Object.defineProperty(navigator, "serviceWorker", { value: { register }, configurable: true });

    renderHook(() => usePushNotifications({ enabled: false }));

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(register).not.toHaveBeenCalled();
  });

  it("registra el SW y queda en 'idle' si no hay suscripción previa", async () => {
    const getSubscription = jest.fn().mockResolvedValue(null);
    const register = jest.fn().mockResolvedValue(mockRegistration(getSubscription, jest.fn()));
    Object.defineProperty(navigator, "serviceWorker", { value: { register }, configurable: true });
    (global as unknown as { Notification: unknown }).Notification = { permission: "default" };

    const { result } = renderHook(() => usePushNotifications({ enabled: true }));

    await waitFor(() => expect(result.current.status).toBe("idle"));
    expect(register).toHaveBeenCalledWith("/sw.js");
  });

  it("queda en 'subscribed' si ya había una suscripción activa", async () => {
    const getSubscription = jest.fn().mockResolvedValue({ endpoint: "https://push.example/1" });
    const register = jest.fn().mockResolvedValue(mockRegistration(getSubscription, jest.fn()));
    Object.defineProperty(navigator, "serviceWorker", { value: { register }, configurable: true });
    (global as unknown as { Notification: unknown }).Notification = { permission: "granted" };

    const { result } = renderHook(() => usePushNotifications({ enabled: true }));

    await waitFor(() => expect(result.current.status).toBe("subscribed"));
  });

  it("queda en 'denied' si el permiso ya estaba bloqueado", async () => {
    const register = jest.fn().mockResolvedValue(mockRegistration(jest.fn(), jest.fn()));
    Object.defineProperty(navigator, "serviceWorker", { value: { register }, configurable: true });
    (global as unknown as { Notification: unknown }).Notification = { permission: "denied" };

    const { result } = renderHook(() => usePushNotifications({ enabled: true }));

    await waitFor(() => expect(result.current.status).toBe("denied"));
  });

  it("queda en 'error' si el registro del SW falla", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    const register = jest.fn().mockResolvedValue(null);
    Object.defineProperty(navigator, "serviceWorker", { value: { register }, configurable: true });

    const { result } = renderHook(() => usePushNotifications({ enabled: true }));

    await waitFor(() => expect(result.current.status).toBe("error"));
    consoleError.mockRestore();
  });

  it("subscribe() completa el flujo happy-path: permiso, VAPID key, pushManager.subscribe, backend", async () => {
    const getSubscription = jest.fn().mockResolvedValue(null);
    const subscription = { endpoint: "https://push.example/1" };
    const subscribeMock = jest.fn().mockResolvedValue(subscription);
    const register = jest.fn().mockResolvedValue(mockRegistration(getSubscription, subscribeMock));
    Object.defineProperty(navigator, "serviceWorker", { value: { register }, configurable: true });
    (global as unknown as { Notification: unknown }).Notification = {
      permission: "default",
      requestPermission: jest.fn().mockResolvedValue("granted"),
    };

    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(
        mockResponse({ ok: true, status: 200, body: JSON.stringify({ publicKey: "aG9sYQ" }) }),
      )
      .mockResolvedValueOnce(mockResponse({ ok: true, status: 200, body: "{}" }));

    const { result } = renderHook(() => usePushNotifications({ enabled: true }));
    await waitFor(() => expect(result.current.status).toBe("idle"));

    await act(async () => {
      await result.current.subscribe();
    });

    expect(subscribeMock).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }));
    expect(result.current.status).toBe("subscribed");
  });

  it("subscribe() queda en 'denied' si el usuario rechaza el permiso", async () => {
    const getSubscription = jest.fn().mockResolvedValue(null);
    const register = jest.fn().mockResolvedValue(mockRegistration(getSubscription, jest.fn()));
    Object.defineProperty(navigator, "serviceWorker", { value: { register }, configurable: true });
    (global as unknown as { Notification: unknown }).Notification = {
      permission: "default",
      requestPermission: jest.fn().mockResolvedValue("denied"),
    };

    const { result } = renderHook(() => usePushNotifications({ enabled: true }));
    await waitFor(() => expect(result.current.status).toBe("idle"));

    await act(async () => {
      await result.current.subscribe();
    });

    expect(result.current.status).toBe("denied");
  });

  it("subscribe() queda en 'error' y loguea la categoría si falla pushManager.subscribe", async () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});
    const getSubscription = jest.fn().mockResolvedValue(null);
    const subscribeMock = jest.fn().mockRejectedValue(new Error("boom"));
    const register = jest.fn().mockResolvedValue(mockRegistration(getSubscription, subscribeMock));
    Object.defineProperty(navigator, "serviceWorker", { value: { register }, configurable: true });
    (global as unknown as { Notification: unknown }).Notification = {
      permission: "default",
      requestPermission: jest.fn().mockResolvedValue("granted"),
    };
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        mockResponse({ ok: true, status: 200, body: JSON.stringify({ publicKey: "aG9sYQ" }) }),
      );

    const { result } = renderHook(() => usePushNotifications({ enabled: true }));
    await waitFor(() => expect(result.current.status).toBe("idle"));

    await act(async () => {
      await result.current.subscribe();
    });

    expect(result.current.status).toBe("error");
    expect(consoleError).toHaveBeenCalledWith(
      "[PUSH] category=pushmanager_subscribe_failed",
      expect.anything(),
    );

    consoleError.mockRestore();
  });
});
