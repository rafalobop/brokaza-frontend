"use client";

/**
 * Formulario de "completar perfil" (KAN-167), portado de la lógica de
 * `POST /api/profile` / `GET /api/localities/tucuman` que ya expone el
 * backend (`matchouse/src/routes/profile.ts`). Se muestra desde `ProfileGate`
 * cuando `useProfile().status === "incomplete"`; al guardar con éxito llama
 * `refresh()` del contexto de perfil, que recalcula el status y desbloquea
 * el resto del dashboard sin necesidad de un redirect real de Next.js.
 */

import { useEffect, useState } from "react";
import { apiClient, ApiError } from "@/lib/api-client";
import { useProfile } from "@/lib/profile-context";

interface LocalitiesResponse {
  localities: string[];
}

export function CompleteProfileForm() {
  const { refresh } = useProfile();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [city, setCity] = useState("");
  const [localities, setLocalities] = useState<string[]>([]);
  const [localitiesError, setLocalitiesError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await apiClient<LocalitiesResponse>("/api/localities/tucuman");
        if (!cancelled) setLocalities(res.localities);
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof ApiError ? err.message : "No pudimos cargar las localidades.";
          setLocalitiesError(message);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiClient("/api/profile", {
        method: "POST",
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone_number: phoneNumber.trim(),
          agency_name: agencyName.trim(),
          city,
        }),
      });
      // `refresh()` recalcula `status` a partir del `profile_completed` que
      // devuelve el backend en la respuesta de éxito (AC2) — no se asume
      // localmente que el guardado desbloqueó el dashboard.
      await refresh();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Error de red al conectar con el servidor.";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold text-black dark:text-zinc-50">Completá tu perfil</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Necesitamos estos datos antes de mostrarte el dashboard.
        </p>
      </div>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700 dark:text-zinc-300">Nombre</span>
          <input
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            autoComplete="given-name"
            disabled={submitting}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-black outline-none focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700 dark:text-zinc-300">Apellido</span>
          <input
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            autoComplete="family-name"
            disabled={submitting}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-black outline-none focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700 dark:text-zinc-300">Teléfono</span>
          <input
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
            placeholder="+54 381 555-5555"
            autoComplete="tel"
            disabled={submitting}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-black outline-none focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700 dark:text-zinc-300">Inmobiliaria</span>
          <input
            value={agencyName}
            onChange={(event) => setAgencyName(event.target.value)}
            autoComplete="organization"
            disabled={submitting}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-black outline-none focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-700 dark:text-zinc-300">Ciudad</span>
          <select
            value={city}
            onChange={(event) => setCity(event.target.value)}
            disabled={submitting || localities.length === 0}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-black outline-none focus:border-zinc-500 disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          >
            <option value="">Seleccioná una ciudad</option>
            {localities.map((locality) => (
              <option key={locality} value={locality}>
                {locality}
              </option>
            ))}
          </select>
          {localitiesError ? (
            <span className="text-xs text-red-600 dark:text-red-400">{localitiesError}</span>
          ) : null}
        </label>
        {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-60 dark:bg-white dark:text-black"
        >
          {submitting ? "Guardando..." : "Guardar y continuar"}
        </button>
      </form>
    </div>
  );
}
