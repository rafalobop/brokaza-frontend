"use client";

/**
 * Reemplaza el `<select>` nativo — su popup de opciones lo pinta el sistema operativo, no la
 * página, y en Windows/Chrome ignora `color-scheme: dark` en la práctica (reportado: opciones
 * blancas con texto blanco en tema oscuro, ilegibles). Este es un listbox propio (botón + panel
 * flotante), así los colores salen 100% de nuestro CSS en los dos temas.
 */

import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
}

export function Select({
  value,
  onChange,
  options,
  disabled,
  ariaLabel,
  className = "",
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => setOpen((prev) => !prev)}
        className={`rounded-radius-sm border-card-border text-foreground focus:border-accent flex w-full items-center justify-between gap-2 border bg-white/8 shadow-sm px-3 py-2 text-left text-sm outline-none disabled:opacity-60 ${className}`}
      >
        <span className="truncate">{selected?.label ?? ""}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
      </button>

      {open ? (
        <ul
          role="listbox"
          id={listboxId}
          aria-label={ariaLabel}
          className="rounded-radius-sm border-card-border bg-paper/80 text-foreground dark:bg-[#1F292B]/80 absolute top-full left-0 z-20 mt-1 max-h-64 min-w-full overflow-y-auto border py-1 shadow-(--shadow) backdrop-blur-xl"
        >
          {options.map((option) => (
            <li key={option.value} role="option" aria-selected={option.value === value}>
              <button
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`hover:bg-accent-glow flex w-full items-center px-3 py-1.5 text-left text-sm whitespace-nowrap ${
                  option.value === value ? "text-accent font-semibold" : "text-foreground"
                }`}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
