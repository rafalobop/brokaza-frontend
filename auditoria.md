# Auditoría — Brokaza Frontend

Fecha: 2026-09-11. Primera auditoría de este repo (`brokaza-frontend`, Next.js/TypeScript — dashboard de tenant + panel admin). Alcance: `src/app/**`, `src/components/**`, `src/lib/**`, `src/service-worker/**`, `public/sw.js`, configuración de build/CI y tests. No repite hallazgos del repo hermano `matchouse` (backend), que tiene su propia `auditoria.md`.

Calidad general del código: notablemente alta. Tipado estricto sin `any` en `src/lib/**`, cleanup de efectos consistente (`isMountedRef`, `AbortController`, `clearInterval`/`clearTimeout`), decisiones de arquitectura documentadas en `docs/*.md` (auth-client-design, magic-link-flow-design, dangerously-set-inner-html-protocol) y coherentes con el código real, sesión 100% en cookie httpOnly (nada de tokens en `localStorage`), supply-chain con `minimumReleaseAge`/`trustPolicy` en `pnpm-workspace.yaml`. No hay hallazgos críticos ni de seguridad grave.

---

## 🟠 Deuda técnica / arquitectura

### 1. ✅ En progreso (working tree, sin commitear al momento de esta auditoría) — Doble conexión WebSocket simultánea al mismo canal

`src/lib/use-upload.ts` abría su propio `new WebSocket(buildMatchCountSocketUrl(...))` independiente del socket que `use-realtime-matches.ts` ya mantenía abierto por sesión. Durante una subida de Excel, la pestaña sostenía 2 conexiones idénticas contra `/ws`, cada una con su propio handshake/reconnect.

**Estado:** ya existe `src/lib/realtime-socket-context.tsx` (`RealtimeSocketProvider`/`useRealtimeSocket`) sin commitear en el working tree al momento de esta auditoría — consolida ambos consumidores en una única conexión multiplexada por `type` de mensaje, con `matches-context.tsx`, `use-realtime-matches.ts` y `use-upload.ts` ya migrados. Falta commitear/verificar que los tests actualizados (`__tests__/realtime-socket-context.test.tsx`, `use-realtime-matches.test.tsx`, `use-upload*.test.tsx`) pasen y cerrar el ítem.

### 2. `auth-context.tsx` y `admin-auth-context.tsx` duplicados casi al carácter

`src/lib/admin-auth-context.tsx:58-194` reimplementa reducer, `statusRef`, `loggingOutRef`, `refresh`, `logout` y el `useMemo` final casi carácter por carácter respecto a `src/lib/auth-context.tsx:60-230` — la única diferencia real es el endpoint y el nombre del campo (`tenant` vs `admin`). ~140 líneas duplicadas que ya muestran una asimetría (un fix referenciado solo en el JSDoc de uno de los dos).

**Fix:** factorizar un `createSessionContext<TSession>(config)` genérico y derivar ambos providers de él.

### 3. Script `start` corre TypeScript en producción con dependencias de dev

`package.json:8` — `"start": "cross-env NODE_ENV=production ts-node server.ts"`, pero `ts-node` y `typescript` están en `devDependencies` (`package.json:47-48`). Si el deploy (aún "no definido" según `README.md:131`) instala solo dependencias de producción, `pnpm start` rompe porque `ts-node` no existe — no hay build compilado del custom server.

**Fix:** mover `ts-node`/`typescript` a `dependencies`, o compilar `server.ts` en el paso de build y correr `node dist/server.js`.

### 4. `window.confirm` nativo en vez del `ConfirmModal` propio del proyecto

`src/components/matches/ActiveSearchItem.tsx:39` usa `window.confirm(...)` para confirmar el archivado de una búsqueda, mientras que el resto de la app (`PropertyRow.tsx:168`, `CollaboratorRow.tsx:98`) usa el componente `ConfirmModal` propio, themeable y accesible. El propio comentario del archivo admite la divergencia como deuda fuera de alcance de su ticket original.

**Fix:** reemplazar por `ConfirmModal`, igual que en `PropertyRow`/`CollaboratorRow`.

### 5. `Select`/`Combobox` custom sin navegación completa por teclado (accesibilidad)

`src/components/ui/Select.tsx:58-98` y `src/components/ui/Combobox.tsx:131-160` implementan `role="listbox"`/`role="option"` a mano, pero solo manejan `Escape` para cerrar — falta `ArrowUp`/`ArrowDown`/`Home`/`End`/typeahead dentro de la lista, el patrón esperado por WAI-ARIA APG para un listbox.

**Fix:** agregar manejo de flechas con roving focus, o adoptar un primitivo accesible existente (Radix/Headless UI) en vez de reimplementarlo.

### 6. `ActiveSearchesSection`/`TeamSection` duplican el mismo patrón de tabs sin abstracción compartida

`src/components/matches/ActiveSearchesSection.tsx:25-34,54-67` y `src/components/team/TeamSection.tsx:34-37,74-89` reimplementan el mismo widget de pestañas (array `{key,label}`, `useState<Tab>`, mismas clases) de forma independiente y ligeramente distinta entre sí.

**Fix:** extraer un componente `Tabs` genérico a `components/ui/`.

---

## 🟡 Medio / mantenibilidad

### 7. Mensajes de error del backend mostrados crudos al usuario, sin capa de traducción

Patrón repetido en ~10 componentes (`PropertyForm.tsx:137`, `PropertyRow.tsx:103,119`, `AddPropertyModal.tsx:27`, `CollaboratorRow.tsx:54,67`, `InviteCollaboratorForm.tsx:67`, `LoginForm.tsx:95`, `AdminLoginForm.tsx:50`, `CoordinatesModal.tsx:87`): `err instanceof ApiError ? err.message : "<mensaje genérico>"`. `ApiError.message` viene del body de la respuesta del backend sin ninguna capa que distinga "mensaje seguro para mostrar" de "detalle interno" — aceptable para validaciones de negocio (400), pero sin contrato explícito.

**Fix:** definir en el backend un contrato explícito de mensajes user-facing vs. debug; no confiar por defecto en `err.message` crudo.

### 8. WS de matches reintenta reconexión indefinidamente

`src/lib/use-realtime-matches.ts:128-140` reintenta con backoff acotado a 15s pero sin techo de intentos — si el backend está caído por horas con la pestaña abierta, sigue reconectando cada 15s para siempre. El polling de respaldo (15-30s) ya cubre la funcionalidad.

**Fix:** desistir tras N intentos fallidos y depender solo del polling.

### 9. Token de magic-link de admin viaja por query string, no por fragment

`src/lib/auth-callback.ts:74-96` (`consumeAuthCallbackQuery`) lee `token_hash`/`type` de `window.location.search` — a diferencia del flujo de tenant (`consumeAuthCallbackHash`, líneas 22-63) que usa el fragment `#access_token=...`, que el navegador nunca envía al servidor. Un query param sí viaja en la request HTTP inicial y puede quedar en logs de acceso de servidor/proxy/CDN y en `Referer` de recursos externos cargados antes del `history.replaceState`. El comentario del archivo explica el trade-off (evitar el allow-list de Redirect URLs de Supabase) pero no discute esta exposición.

**Fix:** confirmar que `verifyOtp` invalida el token tras el primer uso (ventana de exposición acotada) y documentar el trade-off explícitamente en `docs/magic-link-flow-design.md`.

### 10. `pnpm typecheck` es un script roto standalone

`package.json:10` (`"typecheck": "tsc --noEmit"`) falla en un checkout limpio porque necesita `.next/types/`, generado recién por `dev`/`build` — `README.md:60` ya admite que por eso CI no lo usa (usa `pnpm build` para type-check real). Un dev nuevo que corra `pnpm typecheck` se lleva un falso error.

**Fix:** arreglarlo (generar los tipos de Next antes) o quitarlo de `package.json` ya que no cumple su función sola.

### 11. Pre-push hook corre el build completo, sin pre-commit rápido

`.husky/pre-push` corre `format:check` + `lint` + `build` completo (incluye type-check del árbol entero) en cada `git push`; no existe `.husky/pre-commit`. Esto hace cada push lento y difiere toda validación al momento del push — un dev puede acumular varios commits con lint roto antes de enterarse.

**Fix:** agregar un `pre-commit` liviano (lint-staged sobre archivos staged) para feedback inmediato, dejar `build` solo en push/CI.

---

## 🟢 Bajo / cosmético

### 12. Log crudo de CI committeado como "documentación"

`docs/0_lint-format-build.txt` (2009 líneas) es un dump literal de un run viejo de GitHub Actions (timestamps, PID de runner, SHAs de `actions/checkout`, warnings que ya no existen en el código actual) — ruido versionado que queda desactualizado al instante.

**Fix:** borrarlo del repo; si se quiere un ejemplo de output de CI, referenciar el run real en Actions.

### 13. Test de integración muta `tsconfig.json` in-place sin `try/finally`

`__tests__/integration/rewrites-proxy.test.ts:139,175` deja que `next dev` reescriba `tsconfig.json` y lo restaura recién en `afterAll`. Si el proceso muere antes (timeout de 180s excedido, CI matado externamente, Ctrl-C local), el working tree queda con `tsconfig.json` modificado.

**Fix:** envolver en `try/finally`, o usar un tsconfig temporal separado.

### 14. Nombre de función engañoso reusado fuera de su dominio original

`buildMatchCountSocketUrl` (`src/lib/realtime-matches.ts:30`) se reusaba en `use-upload.ts` para un canal que no es "match count" sino progreso de upload (admitido en el propio comentario del archivo). Con la consolidación del ítem #1 esto queda parcialmente resuelto, pero vale renombrarla a algo como `buildDashboardSocketUrl` ya que ahora es explícitamente el socket compartido de todo el dashboard.

---

## Verificaciones puntuales que salieron limpias

- **Sesión/tokens**: 100% cookie httpOnly, sin tokens en `localStorage`/`sessionStorage`; diseño documentado en `docs/auth-client-design.md`.
- **`dangerouslySetInnerHTML`**: único uso en `src/app/layout.tsx:63`, coincide exactamente con `docs/dangerously-set-inner-html-protocol.md`.
- **Tipado**: sin `any`/`as any`/`@ts-ignore` en `src/lib/**`.
- **Cleanup de efectos**: `isMountedRef`, `AbortController`, `clearInterval`/`clearTimeout` aplicados de forma consistente en todos los hooks revisados.
- **`data-*` attributes**: sin PII ni tokens expuestos en el DOM.
- **CI**: `.github/workflows/ci.yml` corre build/test/lint en cada PR (a diferencia del backend, que no tiene CI).
- **Dependencias**: sin secretos hardcodeados en `.env.example`; guard de límite de dependencias (`scripts/check-dependency-limit.mjs`) activo y documentado; `pnpm-workspace.yaml` con `minimumReleaseAge`/`trustPolicy`.
- **Tests**: mocking realista (fetch mockeado por caso), asserts de comportamiento real, no triviales.

---

## Resumen para arrancar

1. **#1** — cerrar lo que ya está en curso: commitear `realtime-socket-context.tsx` y verificar que los tests migrados pasen.
2. **#3** — antes de definir el deploy (`README.md` lo marca como pendiente), mover `ts-node`/`typescript` a `dependencies` o compilar `server.ts`, para no descubrir el problema recién en producción.
3. **#2** — factorizar los dos contextos de auth es el refactor de mayor apalancamiento de mantenibilidad: evita que diverjan silenciosamente.
4. **#4, #5, #6** — mejoras de UI/accesibilidad, bajo esfuerzo, sin dependencias externas.
5. **#7 a #14** — calidad/mantenibilidad, ninguna bloqueante, para ir tomando en paralelo.
