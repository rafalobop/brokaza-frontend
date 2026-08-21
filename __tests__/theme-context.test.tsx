import { act, renderHook } from "@testing-library/react";
import { ThemeProvider, useTheme } from "@/lib/theme-context";
import { THEME_STORAGE_KEY } from "@/lib/theme";

describe("ThemeProvider / useTheme (KAN-256)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
  });

  it("arranca con el tema ya aplicado al <html> por el script sin-FOUC", () => {
    document.documentElement.setAttribute("data-theme", "dark");

    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });

    expect(result.current.theme).toBe("dark");
  });

  it("default 'light' si no hay data-theme en el <html>", () => {
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });

    expect(result.current.theme).toBe("light");
  });

  it("toggleTheme alterna el tema, lo aplica al DOM y lo persiste", () => {
    const { result } = renderHook(() => useTheme(), { wrapper: ThemeProvider });

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.theme).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.theme).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("tira si se usa useTheme() fuera de ThemeProvider", () => {
    const consoleError = jest.spyOn(console, "error").mockImplementation(() => {});

    expect(() => renderHook(() => useTheme())).toThrow(
      "useTheme debe usarse dentro de <ThemeProvider>",
    );

    consoleError.mockRestore();
  });
});
