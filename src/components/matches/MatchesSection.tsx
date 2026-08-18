"use client";

/**
 * `MatchesSection` (KAN-189) — vista "Últimos Matches", orquesta
 * `MatchControls` + `MatchListContainer` + `RejectionModal` a partir de los
 * datos que le pasa `MatchesDashboard`. Portado de la sección "Búsquedas con
 * Resultados" de `matchouse/src/dashboard/index.html` líneas 126-165. Árbol
 * y decisiones de estado documentados en `docs/matches-ui-design.md` (§3,
 * §5).
 *
 * No llama a `useMatches()` acá adentro: `MatchesDashboard` es el único
 * dueño del hook (ver `docs/matches-ui-design.md` §4) para poder agregar su
 * `refetch()` al `onRefetch` de `useRealtimeMatches` (KAN-187) junto con las
 * demás secciones de KAN-190/191. `MatchesSection` solo posee el estado de
 * UI que le es propio: orden, paginación y el modal de rechazo.
 */

import { useMemo, useState } from "react";
import type { MatchesStatus, UseMatchesResult } from "@/lib/use-matches";
import { paginateMatches, sortMatches, type MatchSortOption } from "@/lib/match-sort";
import { MatchControls } from "./MatchControls";
import { MatchListContainer } from "./MatchListContainer";
import { RejectionModal } from "./RejectionModal";

const PAGE_SIZE = 10;

export interface MatchesSectionProps {
  status: MatchesStatus;
  matches: UseMatchesResult["matches"];
  error: string | null;
  sendFeedback: UseMatchesResult["sendFeedback"];
}

export function MatchesSection({ status, matches, error, sendFeedback }: MatchesSectionProps) {
  const [sortOption, setSortOption] = useState<MatchSortOption>("fecha-desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [rejectingMatchId, setRejectingMatchId] = useState<string | null>(null);
  const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const paginated = useMemo(() => {
    const sorted = sortMatches(matches, sortOption);
    return paginateMatches(sorted, currentPage, PAGE_SIZE);
  }, [matches, sortOption, currentPage]);

  function handleSortChange(option: MatchSortOption) {
    setSortOption(option);
    setCurrentPage(1);
  }

  async function submitFeedback(
    matchId: string,
    feedbackStatus: "ACCEPTED" | "REJECTED",
    reason?: string,
  ) {
    setIsSubmittingFeedback(true);
    setFeedbackError(null);
    try {
      await sendFeedback(matchId, feedbackStatus, reason ?? null);
    } catch {
      setFeedbackError("Error al guardar feedback del match.");
    } finally {
      setIsSubmittingFeedback(false);
    }
  }

  function handleAccept(matchId: string) {
    void submitFeedback(matchId, "ACCEPTED");
  }

  function handleReject(matchId: string) {
    setRejectingMatchId(matchId);
  }

  function handleConfirmReject(reason: string) {
    const matchId = rejectingMatchId;
    setRejectingMatchId(null);
    if (!matchId) return;
    void submitFeedback(matchId, "REJECTED", reason);
  }

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-semibold text-black dark:text-zinc-50">
          Búsquedas con Resultados
        </h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Búsquedas que encontraron coincidencias en la cartera de otros agentes. Hacé clic en cada
          match para ver el detalle completo.
        </p>
      </div>

      {status === "loading" ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Cargando matches...</p>
      ) : status === "error" ? (
        <p className="text-sm text-red-600 dark:text-red-400">
          {error ?? "Error al obtener los matches encontrados."}
        </p>
      ) : (
        <>
          {matches.length > 0 ? (
            <MatchControls
              sortOption={sortOption}
              onSortChange={handleSortChange}
              currentPage={paginated.currentPage}
              totalPages={paginated.totalPages}
              startIndex={paginated.startIndex}
              endIndex={paginated.endIndex}
              total={paginated.total}
              onPrevPage={() => setCurrentPage((page) => Math.max(1, page - 1))}
              onNextPage={() => setCurrentPage((page) => page + 1)}
            />
          ) : null}

          {feedbackError ? (
            <p className="text-sm text-red-600 dark:text-red-400">{feedbackError}</p>
          ) : null}

          <MatchListContainer
            matches={paginated.items}
            onAccept={handleAccept}
            onReject={handleReject}
            actionsDisabled={isSubmittingFeedback}
          />
        </>
      )}

      {rejectingMatchId ? (
        <RejectionModal onConfirm={handleConfirmReject} onCancel={() => setRejectingMatchId(null)} />
      ) : null}
    </section>
  );
}
