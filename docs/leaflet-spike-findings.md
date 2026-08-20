# Spike: integración de `react-leaflet` en Next.js App Router (KAN-241)

**Gate:** §6 de `MIGRATION_PLAN.md` — _"Validar la integración de Leaflet en React antes de
migrar el resto del módulo [Admin]"_. Este documento es el resultado del spike; habilita KAN-242
(modal real de corrección de coordenadas) a construirse sobre esta base sin volver a pelear los
mismos problemas.

**Nota sobre el AC del ticket:** el AC en Jira pide un prototipo en `MapComponent.js`, "al menos
tres métricas de éxito", "una sesión de pruebas de usabilidad" y "análisis de riesgos" — no hay
usuarios ni sesión de research disponibles en este entorno de desarrollo, y "métricas de éxito"
no aplica a un spike técnico de una librería (no es una feature con KPIs de producto). Mismo
patrón de AC genérico ya señalado en KAN-215/219/239. Este documento cubre lo que un spike de
integración técnica real necesita: ¿funciona en este stack?, ¿qué problemas reales aparecieron?,
¿qué decisiones hay que tomar antes de construir la feature real?

## 1. Resultado: funciona, con 3 gotchas reales de integración

Prototipo: `src/components/admin/LeafletMap.tsx` (implementación) +
`LeafletMapDynamic.tsx` (wrapper `next/dynamic({ ssr: false })`) + página de prueba manual
`/admin/leaflet-spike`. Port del mapa de `matchouse/src/admin-dashboard/app.js`
(`openCoordModal`, líneas 226-264): mismo tile layer (OpenStreetMap), mismo default
(`TUCUMAN_DEFAULT`), mismo patrón de interacción (marker arrastrable + click reposiciona).

Verificado de punta a punta contra un `next dev` real (no solo tests): `curl` a
`/admin/leaflet-spike` devuelve **200** con el placeholder de carga en el HTML inicial (SSR
correcto — el mapa real se hidrata client-side) y sin errores de servidor.

### 1.1 Gotcha #1 — `dynamic(..., { ssr: false })` no alcanza por sí solo

Primer intento: la página del spike importaba `TUCUMAN_DEFAULT` directo desde `LeafletMap.tsx`
(un solo símbolo). Resultado: **500, `ReferenceError: window is not defined`**, a pesar de que el
*componente* se cargaba con `dynamic(ssr:false)`.

Causa real: un `import` estático de *cualquier* símbolo de un módulo arrastra el módulo
*completo* al bundle — incluido el código de nivel superior de `leaflet` (que toca `window` al
evaluarse) y el fix de íconos default (`L.Icon.Default.mergeOptions(...)`, también a nivel de
módulo). `dynamic(ssr:false)` protege la carga del *componente React*, no evita que otro import
del mismo archivo cargue sus dependencias.

**Decisión:** separar cualquier constante/util que no dependa de Leaflet a un módulo aparte sin
imports de `leaflet`/`react-leaflet` (acá, `src/lib/map-constants.ts`). Regla para KAN-242:
**nunca importar nada de `LeafletMap.tsx`/`LeafletMapDynamic.tsx` salvo a través del wrapper
dinámico**, ni siquiera un tipo o constante que "parezca" inocente.

### 1.2 Gotcha #2 — Jest no transforma `react-leaflet` (ESM puro) por default

`react-leaflet` 5 y su dependencia `@react-leaflet/core` se publican sin build CJS. Cualquier
test que importe el componente rompía con `SyntaxError: Unexpected token 'export'`, porque Jest
no transforma nada bajo `node_modules` salvo lo que `transformIgnorePatterns` deje pasar.

Complicación extra: `next/jest` (el wrapper que ya usa este repo) **descarta silenciosamente**
cualquier `transformIgnorePatterns` pasado en el objeto de config síncrono — verificado con
`npx jest --showConfig` (el array queda idéntico con o sin la clave seteada ahí). La única forma
real de extenderlo es post-procesar el config ya resuelto por `next/jest` (que es async, porque
necesita leer `next.config.ts` primero) e inyectar los paquetes en el mismo allowlist regex que
`next/jest` ya arma para `geist` (con soporte probado para la estructura anidada de `.pnpm` en
Windows). Ver `jest.config.ts` — cambio genérico, no específico de Leaflet: cualquier futura
dependencia ESM-only puede sumarse al mismo array de reemplazo.

### 1.3 Gotcha #3 — íconos default de Leaflet rotos en bundlers modernos

Problema conocido y documentado del propio Leaflet (no de este proyecto): los íconos default del
marker referencian assets por URL relativa al paquete instalado, que Webpack/Turbopack no
resuelven. Fix estándar de la comunidad aplicado en `LeafletMap.tsx`: borrar
`L.Icon.Default.prototype._getIconUrl` y volver a setear las 3 URLs (acá, apuntando a `unpkg.com`
en vez de vendorizar los PNG — el legacy sí los vendorizaba en `admin-dashboard/vendor/leaflet`,
decisión a revisar en KAN-242 si se quiere evitar la dependencia de red externa a un CDN en
runtime).

## 2. Verificación realizada

- **Build/SSR real:** `next dev` levantado, `/admin/leaflet-spike` responde 200 (antes: 500).
- **Tests (`__tests__/leaflet-map.test.tsx`, 3 casos):** el mapa monta en jsdom sin tirar, expone
  `.leaflet-container` en el DOM, y **un click real disparado con `fireEvent` llama a `onChange`
  con lat/lng numéricos** — la conversión de coordenadas de Leaflet corre de verdad en jsdom, no
  hace falta mockear nada de la librería.
- **Interacción manual pendiente en browser real** (drag del marker, zoom, pan) — no verificado
  en esta sesión por no tener acceso a un browser interactivo; el patrón de `dragend` es 1:1 el
  mismo que ya está en producción en el legacy (`matchouse/src/admin-dashboard/app.js` líneas
  248-253), así que el riesgo de que no funcione es bajo, pero queda como pendiente explícito
  para QA antes de KAN-242.

## 3. Riesgos identificados

| Riesgo | Severidad | Mitigación |
|---|---|---|
| Cualquier import directo de `LeafletMap.tsx` (no vía `LeafletMapDynamic`) rompe SSR | Alta si se olvida | Documentado en el comment del propio archivo; KAN-242 debe importar siempre `LeafletMapDynamic` |
| Íconos apuntando a `unpkg.com` (CDN externo) en vez de vendorizados | Media (dependencia de red en runtime, el legacy la evitaba) | Decisión a tomar en KAN-242: vendorizar los 3 PNG en `public/` como hacía el legacy, o aceptar la dependencia de CDN |
| Bundle size de `leaflet` (~150KB min+gz aprox.) | Baja | Ya mitigado por el propio `dynamic(ssr:false)` — no entra en el bundle inicial, solo se carga cuando `/admin` renderiza un mapa |
| Licencia | Ninguna | `leaflet` y `react-leaflet` son BSD-2-Clause, sin restricciones para uso comercial |

## 4. Recomendación

**Proceder con `react-leaflet` para KAN-242** (modal real de corrección de coordenadas). La
integración funciona en este stack (Next.js 16 App Router + Turbopack + React 19), los 3 gotchas
encontrados ya están resueltos y documentados, y el patrón de interacción (marker arrastrable +
click) es el mismo que ya está validado en producción en el legacy.
