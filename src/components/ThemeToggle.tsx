"use client";

import { useTheme } from "@/lib/theme-context";

/** Botón para alternar tema claro/oscuro (KAN-256), port del `theme-toggle-btn` legacy. */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      title={isDark ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      className="text-text-secondary hover:bg-card rounded-full p-2 transition"
    >
      {isDark ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <path d="M12 4.5a1 1 0 0 1 1-1h.01a1 1 0 1 1 0 2H13a1 1 0 0 1-1-1ZM12 19.5a1 1 0 0 1 1-1h.01a1 1 0 1 1 0 2H13a1 1 0 0 1-1-1ZM4.5 12a1 1 0 0 1-1-1v-.01a1 1 0 1 1 2 0V11a1 1 0 0 1-1 1ZM19.5 12a1 1 0 0 1-1-1v-.01a1 1 0 1 1 2 0V11a1 1 0 0 1-1 1ZM6.34 6.34a1 1 0 0 1 1.42 0l.01.01a1 1 0 1 1-1.42 1.42l-.01-.01a1 1 0 0 1 0-1.42ZM16.24 16.24a1 1 0 0 1 1.42 0l.01.01a1 1 0 1 1-1.42 1.42l-.01-.01a1 1 0 0 1 0-1.42ZM6.34 17.66a1 1 0 0 1 0-1.42l.01-.01a1 1 0 1 1 1.42 1.42l-.01.01a1 1 0 0 1-1.42 0ZM16.24 7.76a1 1 0 0 1 0-1.42l.01-.01a1 1 0 1 1 1.42 1.42l-.01.01a1 1 0 0 1-1.42 0ZM12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z" />
        </svg>
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <path d="M20.354 15.354A9 9 0 0 1 8.646 3.646a9.003 9.003 0 1 0 11.708 11.708Z" />
        </svg>
      )}
    </button>
  );
}
