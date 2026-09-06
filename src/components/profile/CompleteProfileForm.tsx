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
 *
 * KAN-306: nuevo campo "Número de matrícula". El backend valida contra el
 * padrón de matriculados y puede devolver 3 resultados distintos, todos
 * mapeados por `refresh()` a través de `useProfile().status` — este
 * formulario no necesita distinguirlos, solo mostrar el error si `apiClient`
 * lanza (caso 'rejected', 403) y dejar que `ProfileGate` decida qué pantalla
 * mostrar después de un submit exitoso ('validated' → "complete",
 * 'pending' → "pending_validation").
 *
 * KAN-306 (cambio de flujo de colaboradores): un tenant `role: "collaborator"` no necesita
 * matrícula propia — opera bajo la del dueño de su agencia (`updateProfile` en el backend ya
 * salta esa validación para este rol). `profile.role` está disponible desde el primer
 * `GET /api/profile` porque el backend setea el rol al momento de la invitación, antes de que el
 * colaborador llegue a ver este formulario — así que el campo se puede ocultar directo, sin
 * estado de carga intermedio.
 *
 * Pase de UI (2026-09-04):
 * - Punto 2: la "Inmobiliaria" de un colaborador ya no es texto libre — el backend la resuelve
 *   siempre del dueño de la agencia (`inviteCollaborator`/`updateProfile`, matchouse), así que
 *   `profile.agency_name` ya viene poblado desde la invitación. Acá el campo queda bloqueado con
 *   ese valor; solo si viniera vacío (el dueño nunca completó el suyo, caso borde) se deja
 *   editable como fallback para no dejar al colaborador sin salida.
 * - Puntos 3/4: el teléfono pasa de un input único de texto libre a un selector de código de país
 *   (default Argentina, "+54") + un input numérico de exactamente 8 dígitos para el número local
 *   — validado client-side antes de pegarle a la red (mismo criterio que la validación de email
 *   en `LoginForm.tsx`), y otra vez server-side (`matchouse/src/utils/profileValidation.ts`).
 * - Punto 7: en pantallas grandes el formulario pasaba por una sola columna angosta (max-w-sm),
 *   quedando innecesariamente largo — pasa a 2 columnas desde el breakpoint md
 *   (grid md:grid-cols-2). Los campos que no tienen pareja natural (Teléfono, que ya es un
 *   compuesto de 2 controles, y Número de matrícula) ocupan el ancho completo
 *   (md:col-span-2) para no dejar un hueco vacío al lado — Nombre/Apellido e
 *   Inmobiliaria/Ciudad sí se emparejan.
 * - Punto 8: el formulario pasa de un solo paso a dos — "Datos personales" (Nombre, Apellido,
 *   Teléfono) y "Inmobiliaria" (Número de matrícula si aplica, Inmobiliaria, Ciudad) — con una
 *   barra de progreso arriba que se llena a medida que cada campo del paso actual queda
 *   correctamente completado (`stepProgress`). El selector de código de país deja de ser un
 *   `<select>` nativo (su popup de opciones lo pinta el SO, no hereda el tema oscuro de la
 *   página — quedaba fondo blanco con texto blanco, ilegible) y pasa a reusar `Select`
 *   (`components/ui/Select.tsx`, ya existente — mismo componente que usa
 *   `MappingConfirmModal` para el mismo problema), con el mismo lenguaje visual que `Combobox`.
 */

import { useMemo, useState } from "react";
import { apiClient, ApiError } from "@/lib/api-client";
import { useProfile } from "@/lib/profile-context";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import { Select } from "@/components/ui/Select";

interface LocalitiesResponse {
  localities: string[];
}

const PHONE_LOCAL_NUMBER_LENGTH = 8;
const TOTAL_STEPS = 2;

const COUNTRY_CODES = [
  { value: "+54", label: "Argentina (+54)" },
  { value: "+598", label: "Uruguay (+598)" },
  { value: "+56", label: "Chile (+56)" },
  { value: "+595", label: "Paraguay (+595)" },
  { value: "+591", label: "Bolivia (+591)" },
  { value: "+55", label: "Brasil (+55)" },
  { value: "+34", label: "España (+34)" },
  { value: "+1", label: "Estados Unidos (+1)" },
];

export function CompleteProfileForm() {
  const { refresh, profile } = useProfile();
  const isCollaborator = profile?.role === "collaborator";
  // Bloqueado salvo el caso borde de que el dueño todavía no haya completado su propio perfil
  // (agency_name null) — ahí no tiene sentido dejar al colaborador con un input vacío sin salida.
  const agencyLocked = isCollaborator && Boolean(profile?.agency_name);
  const [step, setStep] = useState<1 | 2>(1);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phoneCountryCode, setPhoneCountryCode] = useState("+54");
  const [phoneLocalNumber, setPhoneLocalNumber] = useState("");
  const [agencyName, setAgencyName] = useState(agencyLocked ? (profile?.agency_name ?? "") : "");
  const [city, setCity] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [localities, setLocalities] = useState<string[]>([]);
  const [localitiesLoading, setLocalitiesLoading] = useState(false);
  const [localitiesRequested, setLocalitiesRequested] = useState(false);
  const [localitiesError, setLocalitiesError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const firstNameValid = firstName.trim().length > 0;
  const lastNameValid = lastName.trim().length > 0;
  const phoneValid = phoneLocalNumber.trim().length === PHONE_LOCAL_NUMBER_LENGTH;
  const licenseValid = isCollaborator || licenseNumber.trim().length > 0;
  const agencyValid = agencyLocked || agencyName.trim().length > 0;
  const cityValid = city.trim().length > 0;

  // Barra de progreso: fracción de los campos del PASO ACTUAL ya completados correctamente —
  // no del formulario entero, para que avance de forma visible mientras se completa cada paso
  // en vez de arrancar siempre casi lleno en el paso 2.
  const stepProgress = useMemo(() => {
    const fields =
      step === 1
        ? [firstNameValid, lastNameValid, phoneValid]
        : [...(isCollaborator ? [] : [licenseValid]), agencyValid, cityValid];
    const done = fields.filter(Boolean).length;
    return {
      done,
      total: fields.length,
      percent: fields.length === 0 ? 100 : (done / fields.length) * 100,
    };
  }, [
    step,
    firstNameValid,
    lastNameValid,
    phoneValid,
    isCollaborator,
    licenseValid,
    agencyValid,
    cityValid,
  ]);

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

  function handleNext(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    if (!firstNameValid || !lastNameValid) {
      setError("Completá nombre y apellido.");
      return;
    }
    if (!phoneValid) {
      setError(
        `El teléfono debe tener ${PHONE_LOCAL_NUMBER_LENGTH} dígitos después del código de país.`,
      );
      return;
    }
    setStep(2);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    setSubmitting(true);
    try {
      await apiClient("/api/profile", {
        method: "POST",
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone_country_code: phoneCountryCode,
          phone_local_number: phoneLocalNumber.trim(),
          // Un colaborador con la inmobiliaria bloqueada no manda agency_name — el backend la
          // resuelve del dueño (contrato explícito, mismo criterio que license_number abajo).
          ...(agencyLocked ? {} : { agency_name: agencyName.trim() }),
          city,
          // Un colaborador no tiene el campo en pantalla — no manda license_number en vez de
          // mandar un string vacío, para no depender de que el backend lo trate como "sin
          // valor" (contrato más explícito: el campo directamente no aplica a este rol).
          ...(isCollaborator ? {} : { license_number: licenseNumber.trim() }),
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
    <Card className="w-full max-w-sm shadow-(--shadow) md:max-w-2xl">
      <div className="flex flex-col gap-1">
        <h1 className="text-foreground text-lg font-semibold">Completá tu perfil</h1>
        <p className="text-text-secondary text-sm">
          Necesitamos estos datos antes de mostrarte el dashboard.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="text-text-secondary">
            Paso {step} de {TOTAL_STEPS}: {step === 1 ? "Datos personales" : "Inmobiliaria"}
          </span>
          <span className="text-text-secondary">
            {stepProgress.done}/{stepProgress.total}
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="bg-accent h-full rounded-full transition-[width] duration-300"
            style={{ width: `${stepProgress.percent}%` }}
          />
        </div>
      </div>

      {step === 1 ? (
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={handleNext} noValidate>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-text-secondary">Nombre</span>
            <input
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              autoComplete="given-name"
              disabled={submitting}
              autoFocus
              className="rounded-radius-sm border-card-border text-foreground focus:border-accent border bg-white/8 px-3 py-2 shadow-sm outline-none disabled:opacity-60"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-text-secondary">Apellido</span>
            <input
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              autoComplete="family-name"
              disabled={submitting}
              className="rounded-radius-sm border-card-border text-foreground focus:border-accent border bg-white/8 px-3 py-2 shadow-sm outline-none disabled:opacity-60"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm md:col-span-2">
            <span className="text-text-secondary">Teléfono</span>
            <div className="flex gap-2">
              <Select
                value={phoneCountryCode}
                onChange={setPhoneCountryCode}
                options={COUNTRY_CODES}
                disabled={submitting}
                ariaLabel="Código de país"
                className="w-44 shrink-0"
              />
              <input
                value={phoneLocalNumber}
                onChange={(event) =>
                  setPhoneLocalNumber(
                    event.target.value.replace(/\D/g, "").slice(0, PHONE_LOCAL_NUMBER_LENGTH),
                  )
                }
                inputMode="numeric"
                placeholder="38155555"
                autoComplete="tel-national"
                disabled={submitting}
                aria-label="Número de teléfono"
                className="rounded-radius-sm border-card-border text-foreground focus:border-accent w-full border bg-white/8 px-3 py-2 shadow-sm outline-none disabled:opacity-60"
              />
            </div>
            <span className="text-text-secondary text-xs">
              {PHONE_LOCAL_NUMBER_LENGTH} dígitos, sin el código de país.
            </span>
          </label>
          {error ? <p className="text-error text-sm md:col-span-2">{error}</p> : null}
          <Button type="submit" disabled={submitting} className="md:col-span-2">
            Siguiente
          </Button>
        </form>
      ) : (
        <form className="grid grid-cols-1 gap-4 md:grid-cols-2" onSubmit={handleSubmit} noValidate>
          {isCollaborator ? null : (
            <label className="flex flex-col gap-1 text-sm md:col-span-2">
              <span className="text-text-secondary">Número de matrícula</span>
              <input
                value={licenseNumber}
                onChange={(event) => setLicenseNumber(event.target.value)}
                inputMode="numeric"
                placeholder="Ej: 350"
                disabled={submitting}
                autoFocus
                className="rounded-radius-sm border-card-border text-foreground focus:border-accent border bg-white/8 px-3 py-2 shadow-sm outline-none disabled:opacity-60"
              />
            </label>
          )}
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-text-secondary">Inmobiliaria</span>
            <input
              value={agencyName}
              onChange={(event) => setAgencyName(event.target.value)}
              autoComplete="organization"
              disabled={submitting || agencyLocked}
              autoFocus={isCollaborator}
              className="rounded-radius-sm border-card-border text-foreground focus:border-accent border bg-white/8 px-3 py-2 shadow-sm outline-none disabled:opacity-60"
            />
            {agencyLocked ? (
              <span className="text-text-secondary text-xs">
                Asignada por el dueño de tu agencia.
              </span>
            ) : null}
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
          {error ? <p className="text-error text-sm md:col-span-2">{error}</p> : null}
          <div className="flex gap-2 md:col-span-2">
            <Button
              type="button"
              variant="secondary"
              disabled={submitting}
              onClick={() => {
                setError(null);
                setStep(1);
              }}
            >
              Atrás
            </Button>
            <Button type="submit" disabled={submitting} className="flex-1">
              {submitting ? "Guardando..." : "Guardar y continuar"}
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}
