"use client";

/**
 * Estado de tema claro/oscuro (KAN-256).
 *
 * El script sin-FOUC (`buildThemeInitScript`, inline en `<head>` de `layout.tsx`) ya aplicó
 * `data-theme` al `<html>` antes de que este provider monte, así que el estado inicial se lee
 * del DOM (`getAppliedTheme`) en vez de recalcularlo desde `localStorage` — evita un segundo
 * cálculo que pueda desincronizarse de lo que ya se ve en pantalla.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { applyTheme, getAppliedTheme, storeTheme, type Theme } from "./theme";

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => getAppliedTheme());

  useEffect(() => {
    applyTheme(theme);
    storeTheme(theme);
  }, [theme]);

  function toggleTheme(): void {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme debe usarse dentro de <ThemeProvider>");
  }
  return ctx;
}
