"use client";

import { HelpCircle } from "lucide-react";
import { useNextStep } from "nextstepjs";
import { ONBOARDING_TOUR_NAME } from "@/lib/onboarding-tour";

/**
 * Botón de topbar para volver a ver el tour de bienvenida — el autostart
 * (`(dashboard)/layout.tsx`) solo dispara una vez por browser (ver `hasSeenOnboarding`), esto le
 * da al usuario una forma de repetirlo a demanda. Mismo criterio visual que `PushNotificationButton`
 * (ícono solo, sin pill de texto, label vía `aria-label`/`title`).
 */
export function OnboardingTourButton() {
  const { startNextStep } = useNextStep();

  return (
    <button
      type="button"
      onClick={() => startNextStep(ONBOARDING_TOUR_NAME)}
      aria-label="Ver recorrido guiado"
      title="Ver recorrido guiado"
      className="text-text-secondary hover:bg-card rounded-full p-2 transition"
    >
      <HelpCircle className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}
