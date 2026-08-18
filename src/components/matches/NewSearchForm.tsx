"use client";

/**
 * `NewSearchForm` (KAN-191) — form de texto libre, siempre visible (no
 * colapsable, a diferencia del resto de las secciones de Matches). Portado
 * de `matchouse/src/dashboard/index.html` líneas 96-111 y el handler de
 * `app.js` líneas 1300-1338.
 *
 * No usa `useActiveSearches()` directamente: recibe `onSubmitted` desde
 * `MatchesDashboard` (el `refetch` de esa sección) — mismo criterio del
 * mini-diseño (`docs/matches-ui-design.md` §4): "`NewSearchForm` no depende
 * del WS, llama a su propio `refetchActiveSearches()` tras un éxito".
 */

import { useState } from "react";
import { ApiError } from "@/lib/api-client";
import { submitSearch } from "@/lib/matches-api";
import { MAX_SEARCH_TEXT_LENGTH, stripSearchControlChars } from "@/lib/search-text-validation";

export interface NewSearchFormProps {
  onSubmitted: () => void;
}

export function NewSearchForm({ onSubmitted }: NewSearchFormProps) {
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ message: string; type: "success" | "error" } | null>(null);

  function handleChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(stripSearchControlChars(event.target.value));
  }

  async function handleSubmit() {
    const trimmed = text.trim();
    if (!trimmed) {
      setStatus({ message: "Escribí qué estás buscando antes de guardar.", type: "error" });
      return;
    }

    setSubmitting(true);
    setStatus({ message: "Procesando tu búsqueda...", type: "success" });
    try {
      await submitSearch(trimmed);
      setStatus({
        message: '¡Búsqueda guardada! Ya aparece en "Mis búsquedas activas".',
        type: "success",
      });
      setText("");
      onSubmitted();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "No se pudo guardar la búsqueda.";
      setStatus({ message, type: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-black dark:text-zinc-50">
          Iniciar una Nueva Búsqueda
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Describí en texto libre qué propiedad buscás para tus clientes y la cruzamos
          automáticamente contra la cartera de otros agentes.
        </p>
      </div>

      <textarea
        value={text}
        onChange={handleChange}
        maxLength={MAX_SEARCH_TEXT_LENGTH}
        rows={3}
        disabled={submitting}
        placeholder="Ej: Busco depto de 2 dormitorios en alquiler en Barrio Sur, hasta 300 USD..."
        className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-black outline-none focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
      />

      <div className="flex items-center justify-between">
        <span
          className={`text-xs ${
            text.length >= MAX_SEARCH_TEXT_LENGTH
              ? "text-red-600 dark:text-red-400"
              : "text-zinc-500 dark:text-zinc-400"
          }`}
        >
          {text.length}/{MAX_SEARCH_TEXT_LENGTH}
        </span>
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={submitting}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
        >
          {submitting ? "Buscando..." : "Buscar"}
        </button>
      </div>

      {status ? (
        <p
          className={`text-sm ${
            status.type === "error"
              ? "text-red-600 dark:text-red-400"
              : "text-emerald-600 dark:text-emerald-400"
          }`}
        >
          {status.message}
        </p>
      ) : null}
    </section>
  );
}
