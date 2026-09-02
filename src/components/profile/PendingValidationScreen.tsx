"use client";

/**
 * `PendingValidationScreen` (KAN-306, AC5) — se muestra desde `ProfileGate` cuando
 * `useProfile().status === "pending_validation"`: el agente ya completó el formulario con un
 * número de matrícula, pero el backend no pudo confirmarlo contra el padrón todavía (padrón
 * desactualizado, "registro temporal"). No hay nada más que pueda hacer acá salvo esperar — el
 * job en background (`matchouse/src/services/licenseValidationRetry.ts`) lo va a promover a
 * `validated`/`rejected` solo, y avisa por web push cuando eso pase. "Verificar de nuevo" solo
 * refresca el estado por si ya se resolvió y el agente no vio la notificación.
 */

import { useState } from "react";
import { useProfile } from "@/lib/profile-context";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export function PendingValidationScreen() {
  const { refresh } = useProfile();
  const [checking, setChecking] = useState(false);

  async function handleCheckAgain() {
    setChecking(true);
    try {
      await refresh();
    } finally {
      setChecking(false);
    }
  }

  return (
    <Card className="w-full max-w-sm shadow-(--shadow)">
      <div className="flex flex-col gap-1">
        <h1 className="text-foreground text-lg font-semibold">Tu cuenta está en revisión</h1>
        <p className="text-text-secondary text-sm">
          Estamos confirmando tu número de matrícula profesional contra el padrón de matriculados.
          Esto puede tardar un rato — te avisamos apenas esté listo.
        </p>
      </div>
      <Button type="button" variant="secondary" onClick={() => void handleCheckAgain()} disabled={checking}>
        {checking ? "Verificando..." : "Verificar de nuevo"}
      </Button>
    </Card>
  );
}
