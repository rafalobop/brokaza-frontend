"use client";

/**
 * Form de magic-link, 2 pasos (KAN-166) — porteado de
 * `matchouse/src/dashboard/app.js` líneas 592-643 (`authSendMagicLinkBtn`
 * click handler + `authBackBtn`). Mismo criterio: validación de email
 * client-side antes de pegarle a la red, error del backend (400/429) se
 * muestra inline.
 */

import { useState } from "react";
import Image from "next/image";
import { apiClient, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { NoTranslate } from "@/components/ui/NoTranslate";

type Step = "request" | "sent";

export function LoginForm() {
  const { authError, clearAuthError, sessionMessage, clearSessionMessage } = useAuth();
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // `authError` viene del callback de magic-link (link vencido/inválido,
  // KAN-166) y se muestra hasta que el usuario vuelva a interactuar con el
  // form — sin copiarlo a estado local (evita el cascading-render que
  // marcaba react-hooks/set-state-in-effect), se limpia en el punto de uso.
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
      await apiClient("/api/auth/request-magic-link", {
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
            <h1 className="text-foreground text-lg font-semibold">
              Ingresá a <NoTranslate>Brokaza</NoTranslate>
            </h1>
            <p className="text-text-secondary text-sm">
              Te mandamos un link de acceso a tu email, sin contraseña.
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
              placeholder="vos@inmobiliaria.com"
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
              Te mandamos un link de acceso a <strong>{email}</strong>. Tocalo desde el mismo
              dispositivo para entrar.
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
