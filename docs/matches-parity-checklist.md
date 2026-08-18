# Checklist de paridad funcional — módulo Matches (KAN-192)

**Protocolo:** §8 de `MIGRATION_PLAN.md` — _"Cada módulo migrado se entrega con un checklist
de paridad funcional contra el legacy, verificado antes de reemplazarlo"_ y _"Sign-off explícito
de QA por módulo antes de dar de baja el código legacy correspondiente"_. Este documento es el
checklist en sí; el sign-off de QA se registra en Jira (comentario de cierre de este ticket, sesión
`/qa`), no acá — el checklist es el insumo, no el sign-off.

**Nota sobre el AC del ticket:** el AC en Jira menciona `MatchesAPI.js`, `MatchesController.js` y
"6 subtareas asociadas" — ninguno de esos archivos existe en el repo (ni en `matchouse` ni en
`brokaza-frontend`); es texto genérico generado por IA que no corresponde a esta arquitectura.
Este checklist sigue el protocolo real de §8 de `MIGRATION_PLAN.md`, que sí aplica al proyecto.

**Alcance:** las 4 secciones de la UI de Matches implementadas en KAN-189/190/191, contra el
legacy de `matchouse/src/dashboard/app.js`/`index.html`, más la infraestructura de WS/polling de
KAN-187/188.

## 1. Checklist de §8 (bullet "Matches")

| Ítem                               | Legacy                                                          | Nueva implementación                                  | Evidencia                                                                                                                | Estado |
| ---------------------------------- | --------------------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------ |
| Paginación                         | `loadMatches()`, `app.js` L988-1043 (10 por página)             | `paginateMatches()` (`src/lib/match-sort.ts`)         | `match-sort.test.ts` (11 tests: página parcial, clamps, lista vacía)                                                     | ✅     |
| Ordenamiento                       | `sortOption` (fecha/score asc/desc)                             | `sortMatches()` (`src/lib/match-sort.ts`)             | `match-sort.test.ts` (4 variantes de orden)                                                                              | ✅     |
| Feedback aceptar/rechazar          | `sendFeedback()`, modal de rechazo con 5 motivos                | `useMatches().sendFeedback()` + `RejectionModal`      | `use-matches.test.ts`, `matches-section.test.tsx` (8 tests, incl. flujo completo del modal)                              | ✅     |
| Reconexión de WS tras corte de red | Backoff exponencial 1s→15s (`app.js` L562-574)                  | `useRealtimeMatches` (`nextReconnectDelayMs`)         | `use-realtime-matches.test.tsx` (test de backoff con fake timers + mock `WebSocket`)                                     | ✅     |
| Consistencia entre polling y WS    | Polling de respaldo `[15s,30s)` independiente del estado del WS | Mismo criterio, `randomIntervalMs` + `recordPollTick` | `realtime-matches.test.ts`, `dashboard-metrics.test.ts`, `use-realtime-matches.test.tsx` (poll ticks con socket up/down) | ✅     |

## 2. Paridad por vista (más allá del bullet mínimo de §8)

### 2.1 Últimos Matches (KAN-189)

| Comportamiento legacy                                                                | Portado | Evidencia                                                            |
| ------------------------------------------------------------------------------------ | ------- | -------------------------------------------------------------------- |
| `GET /api/matches` sin cambio de contrato                                            | ✅      | `use-matches.test.ts`                                                |
| Acordeón con detalle inline (no hay vista de detalle separada — decisión de KAN-188) | ✅      | `matches-section.test.tsx`                                           |
| Tooltip "Coincidencia de Zona Geográfica" (KAN-92)                                   | ✅      | `match-zone-tooltip.test.ts` (incl. valores no-string sin excepción) |
| Badge de estado (Pendiente/Aceptado/Rechazado)                                       | ✅      | `matches-section.test.tsx`                                           |
| Motivo de rechazo visible tras curar                                                 | ✅      | `matches-section.test.tsx`                                           |

### 2.2 Interesados en tus Propiedades (KAN-190, solo lectura)

| Comportamiento legacy                                  | Portado | Evidencia                                                    |
| ------------------------------------------------------ | ------- | ------------------------------------------------------------ |
| `GET /api/matches/incoming` sin cambio de contrato     | ✅      | `use-incoming-matches.test.ts`                               |
| Sin acciones de curación (exclusivas del buscador)     | ✅      | `incoming-matches-section.test.tsx`                          |
| Link `wa.me` con solo dígitos del teléfono             | ✅      | `incoming-matches-section.test.tsx` (verifica `href` exacto) |
| Link `mailto`                                          | ✅      | `incoming-matches-section.test.tsx`                          |
| Label de contacto con fallback "Sin datos de contacto" | ✅      | `incoming-matches-section.test.tsx`                          |

### 2.3 Mis Búsquedas en Curso (KAN-191)

| Comportamiento legacy                                                                      | Portado | Evidencia                                                      |
| ------------------------------------------------------------------------------------------ | ------- | -------------------------------------------------------------- |
| Crear búsqueda (`POST /api/search`), contador de caracteres, filtro de control chars       | ✅      | `new-search-form.test.tsx`, `search-text-validation.test.ts`   |
| Listar (`GET /api/searches`) con resumen de criterios                                      | ✅      | `use-active-searches.test.ts`, `active-search-summary.test.ts` |
| Archivar con confirmación (`DELETE /api/searches/:id`)                                     | ✅      | `active-searches-section.test.tsx` (confirma y cancela)        |
| Reactivar sin confirmación, solo si `status=expired` (`POST /api/searches/:id/reactivate`) | ✅      | `active-searches-section.test.tsx`                             |
| Badge de "días restantes" con estado urgente (≤2 días)                                     | ✅      | `active-searches-section.test.tsx`                             |

## 3. Contrato de API — sin cambios (§8)

Verificado leyendo el código fuente del backend (`matchouse/src/routes/matches.ts`,
`matchouse/src/routes/search.ts`), no asumido: ningún endpoint consumido por el módulo Matches
cambió de forma, semántica ni status codes durante KAN-187/188/189/190/191. Los AC de KAN-190 y
KAN-191 asumían status codes que el backend real nunca usó (403/201/204) — documentado y
descartado en los comentarios de cierre de esos tickets respectivamente.

## 4. Regresión de la suite

Estado de la suite completa de `brokaza-frontend` al momento de este checklist:

```
Test Suites: 24 passed, 24 total
Tests:       160 passed, 160 total
tsc --noEmit: sin errores
eslint .: sin errores
```

(Reproducible con `npx jest && npx tsc --noEmit && npx eslint .` desde la raíz de
`brokaza-frontend`.)

## 5. Fuera de alcance de este checklist

- **Retiro del código legacy** (`matchouse/src/dashboard/`) — Fase 5 (KAN-258), no este ticket.
  Este checklist es el insumo que habilita ese retiro más adelante, no lo ejecuta.
- **E2E real contra un backend Express corriendo con sesión activa** — no disponible en este
  entorno de desarrollo; toda la evidencia de arriba es de tests unitarios/de componente con
  mocks de `apiClient`/`fetch`, no de un browser real contra el backend. Señalado explícitamente
  en los comentarios de cierre de KAN-189/190/191.

## 6. Sign-off

**Firmado por QA — 2026-08-18.**

Validación independiente en esta sesión (`/qa KAN-192`), sin confiar en los números reportados
por `@frontend`: se re-corrió `npx jest`, `npx tsc --noEmit` y `npx eslint .` desde cero sobre
`brokaza-frontend` (rama `feature/KAN-192`) y se confirmaron los mismos resultados de §4
(**24/24 test suites, 160/160 tests, sin errores de tipo ni de lint**). Se verificó además que
los 14 archivos de test citados en §1/§2 existen en `__tests__/` con esos nombres exactos.

Las 4 secciones del módulo Matches (KAN-189/190/191) y su infraestructura de WS/polling
(KAN-187) quedan con **sign-off de paridad funcional aprobado** contra el legacy de `matchouse`,
sujeto a las exclusiones explícitas de §5 (sin E2E real contra un backend con sesión activa en
este entorno). Esto habilita, en el futuro, el retiro del código legacy correspondiente en la
Fase 5 (KAN-258) — sin que ese retiro sea parte de este ticket.
