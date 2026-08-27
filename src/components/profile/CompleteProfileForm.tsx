"use client";

/**
 * Formulario de "completar perfil" (KAN-167), portado de la lógica de
 * `POST /api/profile` / `GET /api/localities/tucuman` que ya expone el
 * backend (`matchouse/src/routes/profile.ts`). Se muestra desde `ProfileGate`
 * cuando `useProfile().status === "incomplete"`; al guardar con éxito llama
 * `refresh()` del contexto de perfil, que recalcula el status y desbloquea
 * el resto del dashboard sin necesidad de un redirect real de Next.js.
 *
 * KAN-297: el campo "Ciudad" pasó de `<Select>` (combobox cerrado, sin
 * texto) a `<Combobox>` (input con filtrado por texto + entrada libre). El
 * fetch de `GET /api/localities/tucuman` ya no dispara al montar el
 * formulario — se difiere hasta el primer foco del campo (lazy loading, AC),
 * y solo se pide una vez (`localitiesRequested`) aunque el usuario haga foco
 * varias veces.
 */

import { useState } from "react";
import { apiClient, ApiError } from "@/lib/api-client";
import { useProfile } from "@/lib/profile-context";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";

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
  const [localitiesLoading, setLocalitiesLoading] = useState(false);
  const [localitiesRequested, setLocalitiesRequested] = useState(false);
  const [localitiesError, setLocalitiesError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function loadLocalities() {
    // Lazy loading: se pide una sola vez, recién cuando el campo se usa por primera vez, no al
    // montar el formulario — evita el request de red si el usuario nunca llega a tocar "Ciudad".
    if (localitiesRequested) return;
    setLocalitiesRequested(true);
    setLocalitiesLoading(true);
    void (async () => {
      try {
        const res = await apiClient<LocalitiesResponse>("/api/localities/tucuman");
        setLocalities(res.localities);
      } catch (err) {
        const message =
          err instanceof ApiError ? err.message : "No pudimos cargar las localidades.";
        // Un fallo acá no bloquea el resto del form: el combobox admite texto libre igual (AC).
        setLocalitiesError(message);
      } finally {
        setLocalitiesLoading(false);
      }
    })();
  }

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
    <Card className="w-full max-w-sm shadow-(--shadow)">
      <div className="flex flex-col gap-1">
        <h1 className="text-foreground text-lg font-semibold">Completá tu perfil</h1>
        <p className="text-text-secondary text-sm">
          Necesitamos estos datos antes de mostrarte el dashboard.
        </p>
      </div>
      <form className="flex flex-col gap-4" onSubmit={handleSubmit} noValidate>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-text-secondary">Nombre</span>
          <input
            value={firstName}
            onChange={(event) => setFirstName(event.target.value)}
            autoComplete="given-name"
            disabled={submitting}
            className="rounded-radius-sm border-card-border text-foreground focus:border-accent border bg-white/8 shadow-sm px-3 py-2 outline-none disabled:opacity-60"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-text-secondary">Apellido</span>
          <input
            value={lastName}
            onChange={(event) => setLastName(event.target.value)}
            autoComplete="family-name"
            disabled={submitting}
            className="rounded-radius-sm border-card-border text-foreground focus:border-accent border bg-white/8 shadow-sm px-3 py-2 outline-none disabled:opacity-60"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-text-secondary">Teléfono</span>
          <input
            value={phoneNumber}
            onChange={(event) => setPhoneNumber(event.target.value)}
            placeholder="+54 381 555-5555"
            autoComplete="tel"
            disabled={submitting}
            className="rounded-radius-sm border-card-border text-foreground focus:border-accent border bg-white/8 shadow-sm px-3 py-2 outline-none disabled:opacity-60"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-text-secondary">Inmobiliaria</span>
          <input
            value={agencyName}
            onChange={(event) => setAgencyName(event.target.value)}
            autoComplete="organization"
            disabled={submitting}
            className="rounded-radius-sm border-card-border text-foreground focus:border-accent border bg-white/8 shadow-sm px-3 py-2 outline-none disabled:opacity-60"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-text-secondary">Ciudad</span>
          <Combobox
            value={city}
            onChange={setCity}
            onOpen={loadLocalities}
            options={localities}
            loading={localitiesLoading}
            disabled={submitting}
            placeholder="Escribí para buscar tu ciudad"
            ariaLabel="Ciudad"
          />
          {localitiesError ? <span className="text-error text-xs">{localitiesError}</span> : null}
        </label>
        {error ? <p className="text-error text-sm">{error}</p> : null}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Guardando..." : "Guardar y continuar"}
        </Button>
      </form>
    </Card>
  );
}
