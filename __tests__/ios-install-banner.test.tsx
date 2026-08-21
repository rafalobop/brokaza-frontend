import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { IosInstallBanner } from "@/components/IosInstallBanner";

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

describe("IosInstallBanner (KAN-257)", () => {
  const originalUserAgent = navigator.userAgent;

  function setUserAgent(ua: string): void {
    Object.defineProperty(navigator, "userAgent", { value: ua, configurable: true });
  }

  afterEach(() => {
    setUserAgent(originalUserAgent);
    window.localStorage.clear();
  });

  it("no muestra nada fuera de iOS", async () => {
    setUserAgent("Mozilla/5.0 (Linux; Android 14; Pixel 8)");

    render(<IosInstallBanner />);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByText(/Agregar a inicio/i)).not.toBeInTheDocument();
  });

  it("muestra el aviso en iOS fuera de una PWA instalada", async () => {
    setUserAgent(IPHONE_UA);

    render(<IosInstallBanner />);

    await waitFor(() => expect(screen.getByText(/Agregar a inicio/i)).toBeInTheDocument());
  });

  it("no vuelve a mostrarse si ya fue descartado (localStorage)", async () => {
    setUserAgent(IPHONE_UA);
    window.localStorage.setItem("brokaza-ios-install-dismissed", "true");

    render(<IosInstallBanner />);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByText(/Agregar a inicio/i)).not.toBeInTheDocument();
  });

  it("cerrar el aviso lo oculta y persiste la decisión", async () => {
    setUserAgent(IPHONE_UA);

    render(<IosInstallBanner />);
    await waitFor(() => expect(screen.getByText(/Agregar a inicio/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /cerrar aviso/i }));

    expect(screen.queryByText(/Agregar a inicio/i)).not.toBeInTheDocument();
    expect(window.localStorage.getItem("brokaza-ios-install-dismissed")).toBe("true");
  });
});
