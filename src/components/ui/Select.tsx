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
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(
      0,
      options.findIndex((option) => option.value === value),
    ),
  );
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLLIElement | null>>([]);
  const typeaheadRef = useRef({
    buffer: "",
    timer: undefined as ReturnType<typeof setTimeout> | undefined,
  });
  const listboxId = useId();
  const selected = options.find((option) => option.value === value);
  const getOptionId = (index: number) => `${listboxId}-option-${index}`;

  function openMenu() {
    setActiveIndex((prev) => {
      const selectedIndex = options.findIndex((option) => option.value === value);
      return selectedIndex >= 0 ? selectedIndex : Math.min(prev, options.length - 1);
    });
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  function findTypeaheadMatch(char: string) {
    const buffer = (typeaheadRef.current.buffer + char).toLowerCase();
    typeaheadRef.current.buffer = buffer;
    clearTimeout(typeaheadRef.current.timer);
    typeaheadRef.current.timer = setTimeout(() => {
      typeaheadRef.current.buffer = "";
    }, 500);

    const startIndex = buffer.length > 1 ? activeIndex : (activeIndex + 1) % options.length;
    for (let offset = 0; offset < options.length; offset += 1) {
      const index = (startIndex + offset) % options.length;
      if (options[index].label.toLowerCase().startsWith(buffer)) return index;
    }
    return -1;
  }

  function commitOption(index: number) {
    const option = options[index];
    if (!option) return;
    onChange(option.value);
    setActiveIndex(index);
    setOpen(false);
    buttonRef.current?.focus();
  }

  // El foco DOM se queda siempre en el botón (patrón aria-activedescendant de WAI-ARIA APG) —
  // el <ul> nunca recibe foco, así que todo el manejo de teclado vive acá, tanto cerrado como abierto.
  function handleButtonKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (disabled || options.length === 0) return;

    if (!open) {
      switch (event.key) {
        case "ArrowDown":
        case "ArrowUp":
          event.preventDefault();
          openMenu();
          return;
        case "Home":
          event.preventDefault();
          openMenu();
          setActiveIndex(0);
          return;
        case "End":
          event.preventDefault();
          openMenu();
          setActiveIndex(options.length - 1);
          return;
        case "Enter":
        case " ":
          event.preventDefault();
          openMenu();
          return;
        default:
          if (event.key.length === 1 && /\S/.test(event.key)) {
            const match = findTypeaheadMatch(event.key);
            if (match >= 0) {
              setOpen(true);
              setActiveIndex(match);
            }
          }
          return;
      }
    }

    switch (event.key) {
      case "Escape":
        event.preventDefault();
        setOpen(false);
        break;
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((prev) => Math.min(prev + 1, options.length - 1));
        break;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        event.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        commitOption(activeIndex);
        break;
      case "Tab":
        setOpen(false);
        break;
      default:
        if (event.key.length === 1 && /\S/.test(event.key)) {
          const match = findTypeaheadMatch(event.key);
          if (match >= 0) setActiveIndex(match);
        }
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={open ? getOptionId(activeIndex) : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openMenu())}
        onKeyDown={handleButtonKeyDown}
        className={`rounded-radius-sm border-card-border text-foreground focus:border-accent flex w-full items-center justify-between gap-2 border bg-white/8 px-3 py-2 text-left text-sm shadow-sm outline-none disabled:opacity-60 ${className}`}
      >
        <span className="truncate">{selected?.label ?? ""}</span>
        <ChevronDown className="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
      </button>

      {open ? (
        <ul
          role="listbox"
          id={listboxId}
          aria-label={ariaLabel}
          className="rounded-radius-sm border-card-border bg-paper/80 text-foreground absolute top-full left-0 z-20 mt-1 max-h-64 min-w-full overflow-y-auto border py-1 shadow-(--shadow) backdrop-blur-xl dark:bg-[#1F292B]/80"
        >
          {options.map((option, index) => (
            <li
              key={option.value}
              id={getOptionId(index)}
              ref={(node) => {
                optionRefs.current[index] = node;
              }}
              role="option"
              aria-selected={option.value === value}
            >
              <button
                type="button"
                tabIndex={-1}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => commitOption(index)}
                className={`flex w-full items-center px-3 py-1.5 text-left text-sm whitespace-nowrap ${
                  index === activeIndex ? "bg-accent-glow" : ""
                } ${option.value === value ? "text-accent font-semibold" : "text-foreground"}`}
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
