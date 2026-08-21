import { render, screen, waitFor } from "@testing-library/react";
import { PushNotificationButton } from "@/components/PushNotificationButton";

describe("PushNotificationButton (KAN-257)", () => {
  afterEach(() => {
    // @ts-expect-error -- limpieza
    delete navigator.serviceWorker;
    // @ts-expect-error -- limpieza
    delete window.PushManager;
  });

  it("no renderiza nada sin soporte de push", async () => {
    // @ts-expect-error -- simula falta de soporte
    delete window.PushManager;

    render(<PushNotificationButton enabled />);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("muestra 'Activar notificaciones' en estado idle", async () => {
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        register: jest.fn().mockResolvedValue({
          pushManager: { getSubscription: jest.fn().mockResolvedValue(null) },
        }),
      },
      configurable: true,
    });
    (window as unknown as { PushManager: unknown }).PushManager = function () {};
    (global as unknown as { Notification: unknown }).Notification = { permission: "default" };

    render(<PushNotificationButton enabled />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Activar notificaciones" })).toBeEnabled(),
    );
  });

  it("muestra 'Notificaciones activas' (deshabilitado) si ya hay una suscripción", async () => {
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        register: jest.fn().mockResolvedValue({
          pushManager: { getSubscription: jest.fn().mockResolvedValue({ endpoint: "x" }) },
        }),
      },
      configurable: true,
    });
    (window as unknown as { PushManager: unknown }).PushManager = function () {};
    (global as unknown as { Notification: unknown }).Notification = { permission: "granted" };

    render(<PushNotificationButton enabled />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Notificaciones activas" })).toBeDisabled(),
    );
  });

  it("muestra 'Bloqueado' (deshabilitado) si el permiso ya estaba denegado", async () => {
    Object.defineProperty(navigator, "serviceWorker", {
      value: {
        register: jest.fn().mockResolvedValue({ pushManager: { getSubscription: jest.fn() } }),
      },
      configurable: true,
    });
    (window as unknown as { PushManager: unknown }).PushManager = function () {};
    (global as unknown as { Notification: unknown }).Notification = { permission: "denied" };

    render(<PushNotificationButton enabled />);

    await waitFor(() => expect(screen.getByRole("button", { name: "Bloqueado" })).toBeDisabled());
  });
});
