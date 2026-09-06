"use client";

/**
 * `InviteCollaboratorForm` (KAN-306) — otorga acceso a un colaborador por email
 * (`POST /api/admin-panel/collaborators`). Cambio de flujo (pedido explícito del usuario, mismo
 * ticket): ya no hace falta que la persona se haya registrado antes — si el email no tiene
 * cuenta, el backend la crea y le manda el magic link de bienvenida; si ya existe, la vincula y
 * le avisa por mail que tiene acceso. En ambos casos se manda un email al invitado.
 *
 * No usa `useTeam()` directamente: llama a `inviteCollaborator` (API) por su cuenta y solo avisa
 * con `onInvited()` para que el padre refetchee la lista — mismo criterio que `NewSearchForm`
 * con `submitSearch`/`onSubmitted` (`docs/matches-ui-design.md` §4).
 */

import { useState } from "react";
import { ApiError } from "@/lib/api-client";
import { inviteCollaborator } from "@/lib/team-api";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

export interface InviteCollaboratorFormProps {
  onInvited: () => void;
}

export function InviteCollaboratorForm({ onInvited }: InviteCollaboratorFormProps) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ message: string; type: "success" | "error" } | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = email.trim();
    if (!trimmed) return;

    setSubmitting(true);
    setStatus(null);
    try {
      await inviteCollaborator(trimmed);
      setStatus({ message: `Acceso otorgado a ${trimmed}.`, type: "success" });
      setEmail("");
      onInvited();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "No se pudo otorgar el acceso.";
      setStatus({ message, type: "error" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-foreground text-lg font-semibold">Otorgar acceso a un colaborador</h2>
        <p className="text-text-secondary text-sm">
          Ingresá el email del colaborador. Le mandamos un mail para que entre — si todavía no tiene
          cuenta, se la creamos automáticamente.
        </p>
      </div>

      <form className="flex flex-wrap items-start gap-2" onSubmit={handleSubmit} noValidate>
        <input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="colaborador@ejemplo.com"
          autoComplete="email"
          disabled={submitting}
          className="rounded-radius-sm border-card-border text-foreground focus:border-accent min-w-[220px] flex-1 border bg-white/8 px-3 py-2 text-sm shadow-sm outline-none disabled:opacity-60"
        />
        <Button type="submit" disabled={submitting}>
          {submitting ? "Otorgando..." : "Otorgar acceso"}
        </Button>
      </form>

      {status ? (
        <p className={`text-sm ${status.type === "error" ? "text-error" : "text-success"}`}>
          {status.message}
        </p>
      ) : null}
    </Card>
  );
}
