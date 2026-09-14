"use client";

import type { CardComponentProps } from "nextstepjs";

/**
 * Card custom del tour de onboarding — el `DefaultCard` de nextstepjs viene con estilos inline
 * pensados para fondo claro fijo; sobre el panel oscuro de Brokaza (`data-theme="dark"`) el texto
 * quedaba blanco sobre blanco (ilegible salvo al seleccionarlo). Reemplaza esos estilos por los
 * tokens semánticos de `globals.css` (mismos que `Modal`/`Card`/`Button`), así el tour sigue el
 * tema activo del usuario en vez de un blanco fijo.
 */
export function OnboardingTourCard({
  step,
  currentStep,
  totalSteps,
  nextStep,
  prevStep,
  skipTour,
  arrow,
}: CardComponentProps) {
  const isFirst = currentStep === 0;
  const isLast = currentStep === totalSteps - 1;

  return (
    <div className="rounded-radius-lg border-card-border bg-paper/95 text-foreground relative flex w-80 max-w-[90vw] flex-col gap-4 border p-5 shadow-(--shadow) backdrop-blur-xl dark:bg-[#1F292B]/95">
      {step.icon ? <div className="text-2xl">{step.icon}</div> : null}

      <div className="flex flex-col gap-1.5">
        <h3 className="font-heading text-base font-bold">{step.title}</h3>
        <div className="text-text-secondary text-sm leading-relaxed">{step.content}</div>
      </div>

      <div className="flex items-center justify-between gap-3 pt-1">
        <button
          type="button"
          onClick={skipTour}
          className="text-text-secondary hover:text-foreground text-xs font-medium underline underline-offset-4"
        >
          Omitir
        </button>

        <div className="flex items-center gap-2">
          <span className="text-text-secondary text-xs">
            {currentStep + 1} / {totalSteps}
          </span>
          {!isFirst ? (
            <button
              type="button"
              onClick={prevStep}
              className="rounded-radius-sm border-card-border text-foreground border bg-white/50 px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-white/20 dark:bg-white/8"
            >
              Atrás
            </button>
          ) : null}
          <button
            type="button"
            onClick={nextStep}
            className="rounded-radius-sm bg-accent hover:bg-accent-hover dark:text-teal px-3 py-1.5 text-xs font-semibold text-white transition-colors"
          >
            {isLast ? "Finalizar" : "Siguiente"}
          </button>
        </div>
      </div>

      {arrow}
    </div>
  );
}
