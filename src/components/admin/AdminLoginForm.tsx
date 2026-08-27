"use client";

/**
 * `AdminLoginForm` (KAN-239) — mismo flujo de magic-link de 2 pasos que `LoginForm` (KAN-166),
 * pero contra `adminApiClient`/`useAdminAuth`. Sin gate de "perfil completo" (no existe para
 * admin) ni copy que mencione inmobiliarias — es un panel interno, no de cara al agente.
 */

import { useState } from "react";
import Image from "next/image";
import { ApiError } from "@/lib/api-client";
import { adminApiClient } from "@/lib/admin-api-client";
import { useAdminAuth } from "@/lib/admin-auth-context";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

type Step = "request" | "sent";

export function AdminLoginForm() {
  const { authError, clearAuthError, sessionMessage, clearSessionMessage } = useAdminAuth();
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const displayedError = error ?? authError;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes("@")) {
      setError("Ingresá un email válido.");
      clearAuthError();
      clearSessionMessage();
      return;
    }

    setSubmitting(true);
    setError(null);
    clearAuthError();
    clearSessionMessage();
    try {
      await adminApiClient("/api/auth/request-magic-link", {
        method: "POST",
        body: JSON.stringify({ email: trimmedEmail }),
      });
      setStep("sent");
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Error de red al conectar con el servidor.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  function handleBack() {
    setStep("request");
    setError(null);
    clearAuthError();
    clearSessionMessage();
  }

  return (
    <Card className="w-full max-w-sm shadow-(--shadow)">
      <Image
        src="/logo_brokaza.png"
        alt="Brokaza"
        width={56}
        height={56}
        className="mx-auto rounded-full object-cover"
        priority
      />
      {step === "request" ? (
        <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col gap-1">
            <h1 className="text-foreground text-lg font-semibold">Panel admin</h1>
            <p className="text-text-secondary text-sm">
              Acceso restringido — ingresá con tu email autorizado.
            </p>
          </div>
          {sessionMessage && !displayedError ? (
            <p className="text-success text-sm">{sessionMessage}</p>
          ) : null}
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-text-secondary">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="admin@brokaza.com"
              autoComplete="email"
              disabled={submitting}
              className="rounded-radius-sm border-card-border text-foreground focus:border-accent border bg-white/8 px-3 py-2 shadow-sm outline-none disabled:opacity-60"
            />
          </label>
          {displayedError ? <p className="text-error text-sm">{displayedError}</p> : null}
          <Button type="submit" disabled={submitting}>
            {submitting ? "Enviando..." : "Enviar Magic Link"}
          </Button>
        </form>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-foreground text-lg font-semibold">Revisá tu email</h1>
            <p className="text-text-secondary text-sm">
              Si <strong>{email}</strong> está autorizado, te mandamos un link de acceso. Tocalo
              desde el mismo dispositivo para entrar.
            </p>
          </div>
          <button
            type="button"
            onClick={handleBack}
            className="text-text-secondary text-sm font-medium underline underline-offset-4"
          >
            Volver
          </button>
        </div>
      )}
    </Card>
  );
}
