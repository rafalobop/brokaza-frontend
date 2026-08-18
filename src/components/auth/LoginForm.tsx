"use client";

/**
 * Form de magic-link, 2 pasos (KAN-166) — porteado de
 * `matchouse/src/dashboard/app.js` líneas 592-643 (`authSendMagicLinkBtn`
 * click handler + `authBackBtn`). Mismo criterio: validación de email
 * client-side antes de pegarle a la red, error del backend (400/429) se
 * muestra inline.
 */

import { useState } from "react";
import { apiClient, ApiError } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";

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
    <div className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      {step === "request" ? (
        <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col gap-1">
            <h1 className="text-lg font-semibold text-black dark:text-zinc-50">
              Ingresá a Brokaza
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Te mandamos un link de acceso a tu email, sin contraseña.
            </p>
          </div>
          {sessionMessage && !displayedError ? (
            <p className="text-sm text-emerald-600 dark:text-emerald-400">{sessionMessage}</p>
          ) : null}
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-zinc-700 dark:text-zinc-300">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="vos@inmobiliaria.com"
              autoComplete="email"
              disabled={submitting}
              className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-black outline-none focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
            />
          </label>
          {displayedError ? (
            <p className="text-sm text-red-600 dark:text-red-400">{displayedError}</p>
          ) : null}
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
          >
            {submitting ? "Enviando..." : "Enviar Magic Link"}
          </button>
        </form>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h1 className="text-lg font-semibold text-black dark:text-zinc-50">Revisá tu email</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Te mandamos un link de acceso a <strong>{email}</strong>. Tocalo desde el mismo
              dispositivo para entrar.
            </p>
          </div>
          <button
            type="button"
            onClick={handleBack}
            className="text-sm font-medium text-zinc-600 underline underline-offset-4 dark:text-zinc-400"
          >
            Volver
          </button>
        </div>
      )}
    </div>
  );
}
