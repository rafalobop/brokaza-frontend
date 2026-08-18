# Mini-diseño: descomposición en componentes de la UI de Matches (KAN-188)

**Gate de §6 de `MIGRATION_PLAN.md`** — este documento es el entregable de KAN-188 en sí
mismo (complejidad Alta: "Diseño de descomposición en componentes de la UI de Matches").
No se toca código de producto en este ticket; KAN-189/190/191 implementan lo que acá se
define.

## 1. Alcance y fuente de verdad

Inventario funcional extraído de `matchouse/src/dashboard/app.js` (líneas 973-1524) y
`matchouse/src/dashboard/index.html` (líneas 96-181) — el legacy real, no la descripción
genérica del ticket. La UI de Matches hoy es **4 secciones independientes** en la misma
página (no pestañas: `<details>` colapsables que pueden estar todas abiertas a la vez) +
1 modal compartido:

| Sección legacy | Endpoint(s) | Interacción |
|---|---|---|
| Nueva Búsqueda (siempre visible, no colapsable) | `POST /api/search` | Form de texto libre, contador de caracteres, validación de control chars |
| Mis Búsquedas en Curso (`active_searches`) | `GET /api/searches`, `DELETE /api/searches/:id`, `POST /api/searches/:id/reactivate` | Archivar/reactivar |
| Búsquedas con Resultados ("Últimos Matches") | `GET /api/matches`, `POST /api/matches/:id/feedback` | Orden, paginación, aceptar/rechazar (abre modal) |
| Interesados en tus Propiedades | `GET /api/matches/incoming` | Solo lectura, links `wa.me`/`mailto` |
| Modal de Rechazo (compartido por la sección de matches) | — (dispara `POST /api/matches/:id/feedback`) | Radio de motivos + input libre |

Las 4 secciones comparten el mismo disparador de refetch: el WS del contador de matches
(`useRealtimeMatches`, KAN-187) + el polling de respaldo. Ver §4.

## 2. Mapeo AC del ticket → componentes reales

El AC de KAN-188 pide `MatchListContainer` / `MatchDetailContainer` /
`MatchFiltersContainer` — una plantilla genérica (list/detail/filters) que no calza 1:1
con la UX real, porque **no hay una vista de detalle separada**: el detalle de cada match
se expande inline (`<details>`/`<summary>`, patrón acordeón) dentro del mismo ítem de
lista. Introducir un detail panel/route separado cambiaría la UX sin que ningún ticket lo
pida. Mapeo explícito, sin forzar una estructura que no existe en el legacy:

- **`MatchListContainer`** → existe tal cual: el contenedor que orquesta fetch + sort +
  paginación + render de la lista de matches (`MatchesSection`, ver §3).
- **`MatchDetailContainer`** → no es un componente aparte. El "detalle" vive en el cuerpo
  expandible de cada `MatchItem` (razones del match, texto original de la búsqueda,
  acciones aceptar/rechazar) — ya es su propio componente de lista, no hace falta uno
  adicional. Se documenta acá para que quede explícito que la decisión fue **no crear**
  `MatchDetailContainer` como entidad separada.
- **`MatchFiltersContainer`** → el control de orden (`sort-select`) + la paginación, hoy
  UI suelta dentro de la misma sección. Se extrae como `MatchControls` (ver §3) — cumple
  el rol de "filtros/controles" que pide el AC, con nombre ajustado al dominio real (no
  hay filtros de búsqueda per se, solo orden + paginación).

## 3. Árbol de componentes

```
MatchesDashboard                    (orquestador de página — dueño de useRealtimeMatches)
├── NewSearchForm                   (POST /api/search)
├── ActiveSearchesSection           (colapsable — GET /api/searches)
│   └── ActiveSearchItem[]          (archivar / reactivar)
├── MatchesSection                  (colapsable — GET /api/matches)
│   ├── MatchControls               (orden + paginación — "MatchFiltersContainer" del AC)
│   ├── MatchListContainer          (renderiza MatchItem[] ya ordenados/paginados)
│   │   └── MatchItem               (acordeón: resumen + detalle inline + aceptar/rechazar)
│   └── RejectionModal              (POST /api/matches/:id/feedback, status=REJECTED)
└── IncomingMatchesSection          (colapsable, solo lectura — GET /api/matches/incoming)
    └── IncomingMatchItem[]
```

Cada `*Section` es dueña de su propio hook de datos (`useActiveSearches`,
`useMatches`, `useIncomingMatches`) — no hay un store global de "matches". Sigue el
criterio de `react-state-management`: *"Colocate state — keep state as close to where
it's used as possible"* / *"Don't over-globalize"*. A diferencia de Auth/Profile (KAN-160
– KAN-167), que sí son Context globales porque hacen falta en toda la app, los datos de
Matches solo importan dentro de `MatchesDashboard` — no hay otra pantalla que los
consuma. Precedente: `auth-context.tsx`/`profile-context.tsx` usan Context + `useReducer`
porque *sí* son globales; acá cada hook usa `useState`/`useReducer` local sin Context.

## 4. Integración con `useRealtimeMatches` (KAN-187)

`MatchesDashboard` es el único punto que llama a `useRealtimeMatches({ enabled, onRefetch })`.
`onRefetch` agrega los tres refetch de las secciones que dependen del WS/polling (replica
el `Promise.all([loadMatches(), loadActiveSearches(), loadIncomingMatches()])` del legacy
ante `match_count_changed`):

```tsx
const { refetch: refetchMatches } = useMatches();
const { refetch: refetchActiveSearches } = useActiveSearches();
const { refetch: refetchIncoming } = useIncomingMatches();

useRealtimeMatches({
  enabled: authStatus === "authenticated",
  onRefetch: () =>
    Promise.all([refetchMatches(), refetchActiveSearches(), refetchIncoming()]),
});
```

`enabled` se ata a `authStatus === "authenticated"` (`useAuth()`, KAN-160) — reemplaza el
`isUserAuthenticated` global del legacy. `NewSearchForm` no depende del WS: llama a su
propio `refetchActiveSearches()` tras un `POST /api/search` exitoso, igual que el legacy
llama a `loadActiveSearches()` directo.

## 5. Estado del modal de rechazo

`RejectionModal` no es global: `MatchesSection` mantiene `rejectingMatchId: string | null`
en estado local y se lo pasa a `MatchItem` (para abrir) y a `RejectionModal` (para
confirmar/cancelar) — mismo alcance que `currentCurationMatchId` en el legacy, pero como
prop en vez de variable de módulo.

## 6. Contrato con el backend (no cambia — §8 de `MIGRATION_PLAN.md`)

Los tipos de respuesta (`Match`, `ActiveSearch`, `IncomingMatch`) se definen en
`src/lib/matches-api.ts` como wrappers tipados sobre `apiClient` (KAN-155), uno por
endpoint de la tabla de §1. Ningún endpoint cambia de forma ni de semántica — la
paridad se valida contra `postman/housematch-qa.postman_collection.json` como ya
establece el protocolo de §8.

Riesgo heredado a vigilar en KAN-189 (documentado, no resuelto acá): el tooltip de
"Coincidencia de Zona Geográfica" (`ZONE_MATCH_REASON_PREFIX` en el legacy) detecta un
string exacto devuelto por el backend en `reason` — sigue siendo frágil en el port, sin
test que lo cubra del lado del contrato.

## 7. Layout de archivos propuesto (para KAN-189/190/191)

```
src/lib/matches-api.ts          # tipos + wrappers de apiClient para los 6 endpoints de §1
src/lib/use-matches.ts          # hook useMatches (KAN-189): sort, paginación, feedback
src/lib/use-active-searches.ts  # hook useActiveSearches (KAN-191): archivar/reactivar
src/lib/use-incoming-matches.ts # hook useIncomingMatches (KAN-190), solo lectura
src/components/matches/
  MatchesDashboard.tsx           # orquestador, dueño de useRealtimeMatches
  NewSearchForm.tsx               # KAN-191
  ActiveSearchesSection.tsx       # KAN-191
  ActiveSearchItem.tsx            # KAN-191
  MatchesSection.tsx              # KAN-189
  MatchControls.tsx               # KAN-189 ("MatchFiltersContainer" del AC)
  MatchListContainer.tsx          # KAN-189
  MatchItem.tsx                   # KAN-189
  RejectionModal.tsx              # KAN-189
  IncomingMatchesSection.tsx      # KAN-190
  IncomingMatchItem.tsx           # KAN-190
```

## 8. Métricas de éxito (para evaluar el diseño, AC del ticket)

Reusa el checklist de paridad funcional de §8 de `MIGRATION_PLAN.md` (paginación, orden,
feedback aceptar/rechazar, reconexión de WS, consistencia polling/WS) como criterio de
aceptación de KAN-189/190/191, más estos puntos específicos de esta descomposición:

1. **Cero regresión de comportamiento del WS**: el WS sigue siendo puro disparador (nunca
   fuente de datos) — ninguna sección debe leer datos del mensaje WS, solo usarlo como
   señal para llamar a su `refetch()`.
2. **Aislamiento de estado**: ninguna sección debe re-renderizar por un cambio de estado
   de otra (verificable con React DevTools Profiler) — consecuencia directa de no usar un
   store global.
3. **Sign-off de QA por el checklist de §8** antes de retirar el `<section>` legacy
   correspondiente en `matchouse/src/dashboard/index.html`/`app.js` (KAN-258, Fase 5).

## 9. Capacitación del equipo

Proyecto de un solo desarrollador (`@frontend`) — no aplica una capacitación de equipo
formal. Este documento, junto con los skills ya cargados en el nodo Developer
(`nextjs-app-router-patterns`, `react-state-management`) y los precedentes de código ya
mergeados (`auth-context.tsx`, `profile-context.tsx`) cumplen ese rol: son la referencia
de patrones que KAN-189/190/191 deben seguir.

## 10. Aprobación

**Aprobado.** Rafael Lobo Plaza (owner del proyecto, `r.loboplaza14@gmail.com`) aprobó
este mini-diseño el 2026-08-18, incluyendo explícitamente los tres puntos de §2 que
reinterpretan el AC del ticket (no crear `MatchDetailContainer` como componente aparte,
renombrar `MatchFiltersContainer` a `MatchControls`) y la decisión de estado local sin
store global de §3. Sin pedido de cambios. Alcance de la aprobación: el árbol de
componentes de §3, la integración con `useRealtimeMatches` de §4 y el layout de archivos
de §7 quedan habilitados como base de KAN-189/190/191.
