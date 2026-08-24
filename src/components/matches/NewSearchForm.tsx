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
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

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
    <Card className="gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-foreground text-lg font-semibold">Iniciar una Nueva Búsqueda</h2>
        <p className="text-text-secondary text-sm">
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
        className="rounded-radius-sm border-card-border text-foreground focus:border-accent w-full border bg-white/8 px-3 py-2 text-sm outline-none disabled:opacity-60"
      />

      <div className="flex items-center justify-between">
        <span
          className={`text-xs ${
            text.length >= MAX_SEARCH_TEXT_LENGTH ? "text-error" : "text-text-secondary"
          }`}
        >
          {text.length}/{MAX_SEARCH_TEXT_LENGTH}
        </span>
        <Button type="button" onClick={() => void handleSubmit()} disabled={submitting}>
          {submitting ? "Buscando..." : "Buscar"}
        </Button>
      </div>

      {status ? (
        <p className={`text-sm ${status.type === "error" ? "text-error" : "text-success"}`}>
          {status.message}
        </p>
      ) : null}
    </Card>
  );
}
