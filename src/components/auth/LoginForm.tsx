"use client";

/**
 * Form de magic-link, 2 pasos (KAN-166) — porteado de
 * `matchouse/src/dashboard/app.js` líneas 592-643 (`authSendMagicLinkBtn`
 * click handler + `authBackBtn`). Mismo criterio: validación de email
 * client-side antes de pegarle a la red, error del backend (400/429) se
 * muestra inline.
 *
 * KAN-326: `POST /api/auth/request-magic-link` (matchouse/src/routes/authRoutes.ts) devuelve 429
 * con un mensaje genérico y sin `Retry-After` (rate limit de 10 req/10min por IP+email, KAN-82) —
 * no hay forma de derivar el tiempo real restante desde la respuesta. El cooldown de acá es un
 * valor fijo del lado del cliente (`RATE_LIMIT_COOLDOWN_SECONDS`), pensado para frenar el caso más
 * común (doble click / reintentos impacientes), no para reflejar la ventana real del backend.
 */

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { apiClient, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { NoTranslate } from "@/components/ui/NoTranslate";

type Step = "request" | "sent";

const RATE_LIMIT_COOLDOWN_SECONDS = 60;

export function LoginForm() {
  const { authError, clearAuthError, sessionMessage, clearSessionMessage } = useAuth();
  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const cooldownInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (cooldownInterval.current) clearInterval(cooldownInterval.current);
    };
  }, []);

  function startCooldown(seconds: number): void {
    if (cooldownInterval.current) clearInterval(cooldownInterval.current);
    setCooldownSeconds(seconds);
    cooldownInterval.current = setInterval(() => {
      setCooldownSeconds((current) => {
        if (current <= 1) {
          if (cooldownInterval.current) clearInterval(cooldownInterval.current);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
  }

  // `authError` viene del callback de magic-link (link vencido/inválido,
  // KAN-166) y se muestra hasta que el usuario vuelva a interactuar con el
  // form — sin copiarlo a estado local (evita el cascading-render que
  // marcaba react-hooks/set-state-in-effect), se limpia en el punto de uso.
  const displayedError = error ?? authError;
  const isRateLimited = cooldownSeconds > 0;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isRateLimited) return;

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
      if (err instanceof ApiError && err.status === 429) {
        setError(
          "Hiciste demasiados pedidos de acceso seguidos. Esperá un minuto y volvé a intentar.",
        );
        startCooldown(RATE_LIMIT_COOLDOWN_SECONDS);
      } else {
        const message =
          err instanceof ApiError ? err.message : "Error de red al conectar con el servidor.";
        setError(message);
      }
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

  // "Esperá 60s..." → "Esperá 1s..." — cuenta regresiva visible en el propio botón, no solo en el
  // mensaje de arriba (AC "cooldown visual... visible durante el tiempo de espera").
  const submitLabel = isRateLimited
    ? `Esperá ${cooldownSeconds}s...`
    : submitting
      ? "Enviando..."
      : "Enviar Magic Link";

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
              disabled={submitting || isRateLimited}
              className="rounded-radius-sm border-card-border text-foreground focus:border-accent border bg-white/8 px-3 py-2 shadow-sm outline-none disabled:opacity-60"
            />
          </label>
          {displayedError ? <p className="text-error text-sm">{displayedError}</p> : null}
          <Button type="submit" disabled={submitting || isRateLimited}>
            {submitLabel}
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
