# Checklist de paridad funcional — módulo Admin (KAN-243)

**Protocolo:** §8 de `MIGRATION_PLAN.md` — _"Cada módulo migrado se entrega con un checklist
de paridad funcional contra el legacy, verificado antes de reemplazarlo"_ y _"Sign-off explícito
de QA por módulo antes de dar de baja el código legacy correspondiente"_. Este documento es el
checklist en sí; el sign-off de QA se registra en Jira (comentario de cierre de este ticket,
sesión `/qa`) y en §6 más abajo — mismo criterio ya usado en `matches-parity-checklist.md`
(KAN-192) y `upload-parity-checklist.md` (KAN-219).

**Alcance:** las 4 historias del módulo Admin — KAN-239 (auth reusando el cliente unificado),
KAN-240 (listado paginado + búsqueda), KAN-241 (spike de Leaflet, gate técnico), KAN-242 (modal
de corrección de coordenadas) — contra el legacy de
`matchouse/src/admin-dashboard/app.js`/`index.html`.

## 1. Checklist de §8 (bullet "Admin")

El bullet real de §8 dice: _"listado/búsqueda paginada, corrección de coordenadas con el mapa"_.
Se agrega auth como prerequisito de acceso al resto del módulo, mismo criterio que el checklist
de Matches trató WS/polling como infraestructura transversal.

| Ítem                                  | Legacy                                                                  | Nueva implementación                                                                    | Evidencia                                                                                                                     | Estado |
| ------------------------------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------ |
| Auth (magic-link + allowlist)         | `admin-dashboard/app.js` (auth duplicada del tenant, líneas 32-109)     | `AdminAuthProvider`/`useAdminAuth` + `AdminLoginForm` (KAN-239)                         | `admin-auth-context.test.tsx` (8), `admin-login-form.test.tsx` (4), `admin-api-client.test.ts` (2)                            | ✅     |
| Listado paginado                      | `loadProperties`/`renderPagination` (`app.js` L148-224, `PAGE_SIZE=50`) | `useProperties`/`PropertyList` (KAN-240) — `pageSize` viene del backend, no hardcodeado | `use-properties.test.ts` (7), `property-list.test.tsx` (9)                                                                    | ✅     |
| Búsqueda por dirección                | Debounce 350ms (`app.js` L216-224)                                      | Mismo debounce (350ms, `setTimeout` manual) en `useProperties`                          | `use-properties.test.ts` (coalesce de tecleo rápido, no pega a la red antes de los 350ms)                                     | ✅     |
| Corrección de coordenadas con el mapa | `openCoordModal` + Leaflet vendorizado (`app.js` L226-306)              | `CoordinatesModal` + `LeafletMapDynamic` (KAN-241/242)                                  | `leaflet-map.test.tsx` (3, incl. click real con `fireEvent`), `coordinates-api.test.ts` (2), `coordinates-modal.test.tsx` (7) | ✅     |

## 2. Paridad por sub-feature (más allá del bullet mínimo de §8)

| Comportamiento legacy                                                                  | Portado | Evidencia                                                                                                   |
| -------------------------------------------------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------- |
| Badge de zona (`zoneBadge`, `point`/`text`/`none`/discrepancia con `title`)            | ✅      | `zone-badge.test.tsx` (4)                                                                                   |
| `TUCUMAN_DEFAULT` como fallback si la propiedad no tiene coordenadas                   | ✅      | `coordinates-modal.test.tsx` ("propiedad sin coordenadas...")                                               |
| Marker arrastrable + click en el mapa reposiciona (`dragend`/`click` de Leaflet)       | ✅      | `leaflet-map.test.tsx` (click real via `fireEvent`, conversión de coordenadas real de Leaflet, no mockeada) |
| Validación de rango lat/lng antes de guardar (`-90..90`/`-180..180`)                   | ✅      | `coordinates-modal.test.tsx`                                                                                |
| Guardar → refetch del listado → cerrar el modal tras un instante mostrando "Guardado." | ✅      | `coordinates-modal.test.tsx`, `property-list.test.tsx`                                                      |
| Botón "Corregir" por fila                                                              | ✅      | `property-list.test.tsx`                                                                                    |
| Auth con allowlist de emails (no self-signup, a diferencia del tenant)                 | ✅      | Verificado leyendo `matchouse/src/adminAuth.ts` — `isAllowedAdminEmail`/`isAllowedAdminUser` sin cambios    |
| Interceptor de 401 (mismo mecanismo que el tenant, `auth-events.ts` compartido)        | ✅      | `admin-auth-context.test.tsx` ("un 401 en medio de una sesión activa desloguea")                            |

## 3. Contrato de API — sin cambios

Verificado leyendo el código fuente del backend (`matchouse/src/adminRoutes.ts`, `adminAuth.ts`),
no asumido: ningún endpoint consumido por el módulo Admin cambió de forma, semántica ni status
codes durante KAN-239/240/241/242.

- `POST /api/auth/request-magic-link`, `POST /api/auth/exchange-token`, `GET /api/auth/session`,
  `POST /api/auth/logout` — sin cambios (cookie `brokaza_admin_session`, allowlist `admin_users`).
- `GET /api/properties` — sin cambios (paginación `page`/`pageSize`/`total`, búsqueda `search`).
- `PATCH /api/properties/:id/coordinates` — sin cambios (verificado también en el comentario de
  cierre de QA de KAN-242, línea exacta `src/adminRoutes.ts:333`).

**Nuevo en el frontend (no en el backend):** el prefijo de proxy `/admin/api/*` →
`ADMIN_BACKEND_ORIGIN` (`next.config.ts`, KAN-239) — necesario porque el backend distingue
tenant/admin por Host header y un único `BACKEND_ORIGIN` no alcanza para los dos. Detalle completo
en `docs/admin-auth-design.md`.

## 4. Regresión de la suite

Estado de la suite completa de `brokaza-frontend` al momento de este checklist (rama
`feature/KAN-243`, incluye Upload + Matches + Admin):

```
Test Suites: 42 passed, 42 total
Tests:       264 passed, 264 total
tsc --noEmit: sin errores
eslint .: sin errores
```

(Reproducible con `npx jest && npx tsc --noEmit && npx eslint .` desde la raíz de
`brokaza-frontend`.)

## 5. Fuera de alcance de este checklist

- **Retiro del código legacy** (`matchouse/src/admin-dashboard/`) — Fase 5 (KAN-258), no este
  ticket. Este checklist es el insumo que habilita ese retiro más adelante, no lo ejecuta.
- **Dashboard de métricas** (`GET /api/metrics`, polling cada 7s en el legacy) — no forma parte
  del roadmap de Fase 4 (§12 solo lista 4 historias: auth/listado/spike/coordenadas). Sigue
  sirviéndose desde `admin-dashboard/` legacy hasta que exista un ticket dedicado.
- **E2E real contra un backend Express corriendo con sesión admin activa** — no disponible en
  este entorno de desarrollo. Toda la evidencia de §1/§2 es de tests unitarios/de componente con
  mocks de `apiClient`/`fetch`, salvo la verificación puntual de KAN-241 (SSR real de
  `/admin/leaflet-spike` contra un `next dev` levantado, con `curl`) y KAN-243 no repite esa
  verificación por no ser parte de su alcance.
- **Interacción manual de drag/zoom/pan del mapa en un browser real** — pendiente explícito desde
  KAN-241/242 (documentado en `docs/leaflet-spike-findings.md` §2), no resuelto en este checklist
  por no tener acceso a un browser interactivo en ninguna de las sesiones de dev/QA hasta ahora.
- **Sesión de capacitación del equipo / pruebas de usuario / análisis de madurez de la biblioteca**
  — ruido de AC no aplicable, ya señalado en los comentarios de cierre de KAN-239/241/242.

## 6. Sign-off

_(Pendiente — a completar por `@qa` en la sesión `/qa KAN-243`, siguiendo el mismo criterio de
verificación independiente que `matches-parity-checklist.md` §6 y `upload-parity-checklist.md`
§6: re-correr la suite desde cero, no confiar en los números de arriba sin reproducirlos.)_
