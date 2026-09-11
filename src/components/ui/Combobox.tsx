"use client";

/**
 * Variante de `Select` con input de texto libre (KAN-297): filtra `options` a medida que se
 * escribe (con debounce, para no re-filtrar en cada tecla sobre listas grandes) y, a diferencia
 * de `Select`, permite confirmar un valor que no está en `options` — el checkout de "ciudad" no
 * puede bloquear a un agente cuya localidad no figura en el listado de Georef/fallback.
 */

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export interface ComboboxProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  /** Se dispara la primera vez que el usuario abre el combobox — hook para lazy loading. */
  onOpen?: () => void;
  loading?: boolean;
  disabled?: boolean;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
}

const FILTER_DEBOUNCE_MS = 150;

export function Combobox({
  value,
  onChange,
  options,
  onOpen,
  loading,
  disabled,
  placeholder,
  ariaLabel,
  className = "",
}: ComboboxProps) {
  const [inputValue, setInputValue] = useState(value);
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [lastSyncedValue, setLastSyncedValue] = useState(value);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [lastFilteredOptions, setLastFilteredOptions] = useState<string[]>(options);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<Array<HTMLLIElement | null>>([]);
  const listboxId = useId();
  const getOptionId = (index: number) => `${listboxId}-option-${index}`;

  // El valor puede cambiar desde afuera (ej. reset del form) sin pasar por handleInputChange —
  // patrón "ajustar estado durante el render" en vez de un useEffect, para no disparar un
  // segundo render en cascada por cada cambio de `value`.
  if (value !== lastSyncedValue) {
    setLastSyncedValue(value);
    setInputValue(value);
    setQuery(value);
  }

  useEffect(() => {
    const timer = setTimeout(() => setQuery(inputValue), FILTER_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [inputValue]);

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

  const filteredOptions = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return options;
    return options.filter((option) => option.toLowerCase().includes(needle));
  }, [options, query]);

  // El índice activo se resetea cada vez que cambia el set filtrado (nueva tecleada) para no
  // dejar resaltada una opción que ya no está en la lista — ajuste durante el render, como
  // lastSyncedValue arriba, en vez de un efecto que dispararía un segundo render en cascada.
  if (lastFilteredOptions !== filteredOptions) {
    setLastFilteredOptions(filteredOptions);
    setActiveIndex(filteredOptions.length > 0 ? 0 : -1);
  }

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [open, activeIndex]);

  function handleFocus() {
    if (disabled) return;
    setOpen(true);
    onOpen?.();
  }

  function handleInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const next = event.target.value;
    setInputValue(next);
    // Se propaga tal cual se escribe (AC: permitir agregar manualmente una ciudad ausente del
    // listado) — la lista desplegable es una sugerencia, no la única fuente de verdad del valor.
    onChange(next);
    setOpen(true);
  }

  function selectOption(option: string) {
    setInputValue(option);
    setQuery(option);
    onChange(option);
    setOpen(false);
  }

  function handleInputKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (disabled) return;
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (!open) {
          setOpen(true);
          return;
        }
        if (filteredOptions.length > 0) {
          setActiveIndex((prev) => Math.min(prev + 1, filteredOptions.length - 1));
        }
        break;
      case "ArrowUp":
        event.preventDefault();
        if (!open) {
          setOpen(true);
          return;
        }
        if (filteredOptions.length > 0) {
          setActiveIndex((prev) => Math.max(prev - 1, 0));
        }
        break;
      case "Home":
        if (open && filteredOptions.length > 0) {
          event.preventDefault();
          setActiveIndex(0);
        }
        break;
      case "End":
        if (open && filteredOptions.length > 0) {
          event.preventDefault();
          setActiveIndex(filteredOptions.length - 1);
        }
        break;
      case "Enter":
        if (open && activeIndex >= 0 && filteredOptions[activeIndex]) {
          event.preventDefault();
          selectOption(filteredOptions[activeIndex]);
        }
        break;
      case "Escape":
        if (open) {
          event.preventDefault();
          setOpen(false);
        }
        break;
      default:
        break;
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <div
        className={`rounded-radius-sm border-card-border text-foreground focus-within:border-accent flex w-full items-center gap-2 border bg-white/8 px-3 py-2 shadow-sm disabled:opacity-60 ${className}`}
      >
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={open && activeIndex >= 0 ? getOptionId(activeIndex) : undefined}
          aria-label={ariaLabel}
          value={inputValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleInputKeyDown}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          className="text-foreground w-full bg-transparent text-sm outline-none disabled:cursor-not-allowed"
        />
        <ChevronDown className="h-4 w-4 shrink-0 opacity-70" aria-hidden="true" />
      </div>

      {open ? (
        <ul
          role="listbox"
          id={listboxId}
          aria-label={ariaLabel}
          className="rounded-radius-sm border-card-border bg-paper/80 text-foreground absolute top-full left-0 z-20 mt-1 max-h-64 min-w-full overflow-y-auto border py-1 shadow-(--shadow) backdrop-blur-xl dark:bg-[#1F292B]/80"
        >
          {loading ? (
            <li className="text-text-secondary px-3 py-1.5 text-sm">Cargando ciudades...</li>
          ) : filteredOptions.length === 0 ? (
            <li className="text-text-secondary px-3 py-1.5 text-sm">
              Sin coincidencias — podés usar &quot;{inputValue.trim() || "..."}&quot; igual.
            </li>
          ) : (
            filteredOptions.map((option, index) => (
              <li
                key={option}
                id={getOptionId(index)}
                ref={(node) => {
                  optionRefs.current[index] = node;
                }}
                role="option"
                aria-selected={option === value}
              >
                <button
                  type="button"
                  tabIndex={-1}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectOption(option)}
                  className={`flex w-full items-center px-3 py-1.5 text-left text-sm whitespace-nowrap ${
                    index === activeIndex ? "bg-accent-glow" : ""
                  } ${option === value ? "text-accent font-semibold" : "text-foreground"}`}
                >
                  {option}
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
