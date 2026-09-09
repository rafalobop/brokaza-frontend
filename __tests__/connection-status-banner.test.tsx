import { act, render, screen, waitFor } from "@testing-library/react";
import { ConnectionStatusBanner } from "@/components/ConnectionStatusBanner";

function setOnline(value: boolean): void {
  Object.defineProperty(window.navigator, "onLine", { configurable: true, value });
}

describe("ConnectionStatusBanner (KAN-325)", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    setOnline(true);
  });

  afterEach(() => {
    act(() => jest.runOnlyPendingTimers());
    jest.useRealTimers();
  });

  it("no muestra nada mientras el navegador está online y no hubo cambios", () => {
    render(<ConnectionStatusBanner />);
    act(() => jest.advanceTimersByTime(1000));
    expect(screen.queryByText("Sin conexión")).not.toBeInTheDocument();
    expect(screen.queryByText("Conectado")).not.toBeInTheDocument();
  });

  it("muestra 'Sin conexión' al perder conectividad, después del debounce", () => {
    render(<ConnectionStatusBanner />);

    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event("offline"));
    });
    // Antes de que venza el debounce, todavía no debería mostrarse.
    expect(screen.queryByText("Sin conexión")).not.toBeInTheDocument();

    act(() => jest.advanceTimersByTime(500));
    expect(screen.getByText("Sin conexión")).toBeInTheDocument();
  });

  it("muestra 'Conectado' al recuperar conectividad y se autooculta después del tiempo configurado", () => {
    render(<ConnectionStatusBanner autoHideMs={2000} />);

    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event("offline"));
      jest.advanceTimersByTime(500);
    });
    expect(screen.getByText("Sin conexión")).toBeInTheDocument();

    act(() => {
      setOnline(true);
      window.dispatchEvent(new Event("online"));
      jest.advanceTimersByTime(500);
    });
    expect(screen.getByText("Conectado")).toBeInTheDocument();
    expect(screen.queryByText("Sin conexión")).not.toBeInTheDocument();

    act(() => jest.advanceTimersByTime(2000));
    expect(screen.queryByText("Conectado")).not.toBeInTheDocument();
  });

  it("hace debounce de togglees rápidos de online/offline sin parpadear el estado intermedio", () => {
    render(<ConnectionStatusBanner />);

    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event("offline"));
      jest.advanceTimersByTime(100);
      setOnline(true);
      window.dispatchEvent(new Event("online"));
      jest.advanceTimersByTime(100);
      setOnline(false);
      window.dispatchEvent(new Event("offline"));
    });
    // Todavía dentro de la ventana de debounce del último evento — nada se mostró todavía.
    expect(screen.queryByText("Sin conexión")).not.toBeInTheDocument();
    expect(screen.queryByText("Conectado")).not.toBeInTheDocument();

    act(() => jest.advanceTimersByTime(500));
    expect(screen.getByText("Sin conexión")).toBeInTheDocument();
  });

  it("muestra 'Sin conexión' de inmediato si el navegador ya está offline al montar", async () => {
    setOnline(false);
    render(<ConnectionStatusBanner />);

    act(() => jest.advanceTimersByTime(500));
    await waitFor(() => expect(screen.getByText("Sin conexión")).toBeInTheDocument());
  });

  it("usa role=status con aria-live=polite para no interrumpir lectores de pantalla", () => {
    render(<ConnectionStatusBanner />);
    act(() => {
      setOnline(false);
      window.dispatchEvent(new Event("offline"));
      jest.advanceTimersByTime(500);
    });
    expect(screen.getByRole("status")).toHaveAttribute("aria-live", "polite");
  });
});
