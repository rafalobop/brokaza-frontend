"use client";

/**
 * `AdminLoginForm` (KAN-239) — mismo flujo de magic-link de 2 pasos que `LoginForm` (KAN-166),
 * pero contra `adminApiClient`/`useAdminAuth`. Sin gate de "perfil completo" (no existe para
 * admin) ni copy que mencione inmobiliarias — es un panel interno, no de cara al agente.
 */

import { useState } from "react";
import { ApiError } from "@/lib/api-client";
import { adminApiClient } from "@/lib/admin-api-client";
import { useAdminAuth } from "@/lib/admin-auth-context";

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
    <div className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      {step === "request" ? (
        <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col gap-1">
            <h1 className="text-lg font-semibold text-black dark:text-zinc-50">Panel admin</h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Acceso restringido — ingresá con tu email autorizado.
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
              placeholder="admin@brokaza.com"
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
              Si <strong>{email}</strong> está autorizado, te mandamos un link de acceso. Tocalo
              desde el mismo dispositivo para entrar.
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
