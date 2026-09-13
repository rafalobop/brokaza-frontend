# Mini-diseño: flujo de magic-link (KAN-166)

Complejidad Alta (MIGRATION_PLAN.md §12, Fase 1). Gate obligatorio antes de
codear — sigue el mismo criterio que `docs/auth-client-design.md` (KAN-160/161).

## 1. Alcance

Request + parsing de callback + exchange de token, reusando `apiClient`
(KAN-155) y `AuthProvider`/`useAuth` (KAN-160) tal cual existen hoy — **no**
se toca su contrato. Fuera de alcance: gate de perfil incompleto (KAN-167),
logout UI (KAN-168), y cualquier UI del dashboard posterior al login (Fase 2+).

## 2. Comportamiento legacy a preservar

Fuente: `matchouse/src/dashboard/app.js` líneas 403-457 (parsing de hash) y
592-643 (form de request). Dos piezas:

- **`handleMagicLinkCallback()`**: si `location.hash` contiene
  `access_token=`, lo extrae, limpia el hash (`history.replaceState`) y
  hace `POST /api/auth/exchange-token`.
- **`handleAuthErrorCallback()`**: si el hash contiene `error=` (link
  vencido o ya usado), extrae `error_code`/`error_description`, limpia el
  hash, y arma un mensaje distinto para `otp_expired` vs. cualquier otro
  código.
- **Form de 2 pasos**: paso 1 (email + "Enviar Magic Link"), paso 2
  ("Revisá tu email" + volver). Validación de email client-side antes de
  pegarle a la red. Errores del backend (400 email inválido, 429 rate
  limit) se muestran inline.

## 3. Dónde vive el parsing del hash

El magic link de Supabase redirige siempre a la **raíz** de `APP_URL`
(`emailRedirectTo: config.appUrl`, sin path — `matchouse/src/routes/auth.ts:61`),
así que el parsing no puede vivir en una ruta aparte (`/auth/callback`) sin
cambiar `emailRedirectTo` en el backend, fuera de alcance de este ticket.

**Decisión:** el parsing se hace dentro de `AuthProvider` (`auth-context.tsx`),
en el mismo `useEffect` que ya dispara `refresh()` al montar — es
"resolución inicial de sesión", coherente con el resto del bootstrap, evita
un segundo lugar con lógica de sesión, y corre en la raíz del árbol sin
importar qué página esté montada. Orden: (1) si hay `access_token=` en el
hash, exchange + limpiar hash; (2) si hay `error=`, guardar mensaje +
limpiar hash; (3) `refresh()` (recién ahí, para que si hubo exchange
exitoso ya levante la sesión nueva). Nuevo campo `authError: string | null`
en el contexto (estado transitorio de UI, separado del reducer de sesión).

## 4. Componentes nuevos

- `src/components/auth/LoginForm.tsx` ("use client"): los 2 pasos del
  legacy, usando `apiClient` para `request-magic-link`. Muestra
  `useAuth().authError` si viene seteado (caso: usuario llegó con un link
  vencido).
- `src/app/page.tsx` pasa a un Client Component chico que renderiza según
  `useAuth().status`: `loading` → placeholder mínimo; `unauthenticated` →
  `<LoginForm />`; `authenticated` → placeholder "Sesión iniciada como
  {tenant.email}" + botón logout (el dashboard real es de tickets
  posteriores).
- `src/app/layout.tsx` envuelve `children` con `<AuthProvider>`.

## 5. Bloqueante para probar de punta a punta (no se resuelve en este ticket)

`APP_URL` en el `.env` de matchouse apunta hoy a `http://localhost:3000`
(Express). Con Next.js como superficie real, el callback tiene que
aterrizar en el origen de Next (`:3001` en dev). Es una env var real que
afecta emails de magic-link en producción — **no se cambia sin que el
usuario lo confirme explícitamente**. Se prueba con tests (hash simulado en
jsdom), no con un magic-link real, hasta que se resuelva esto.

## 6. Testing

- `LoginForm`: paso 1 por default; email inválido no llama a la red; submit
  válido pasa a paso 2; error del backend se muestra inline; "Volver"
  resetea a paso 1.
- `auth-context.test.tsx` (extiende la suite ya existente): hash con
  `access_token=` dispara exchange y termina `authenticated`; hash con
  `error=otp_expired` limpia el hash y expone el mensaje de "vencido";
  sin hash, comportamiento sin cambios (regresión de los tests ya
  existentes).

## 7. Variante admin (KAN-342): token por query string en vez de fragment

El flujo de tenant de arriba (§3) depende del fragment (`#access_token=...`) del redirect
hosteado de Supabase — el fragment nunca sale del browser, no llega al servidor ni a ningún log.
El admin (`consumeAuthCallbackQuery`, `auth-callback.ts:74-96`) rompe ese patrón a propósito: el
`token_hash` viaja en el **query string** (`?token_hash=...&type=magiclink`) de un link armado por
el propio backend (`matchouse/src/adminRoutes.ts#request-magic-link`), no por el redirect hosteado
de Supabase — ver el comentario ahí (línea ~114-124) para el trade-off que motivó el cambio
(evitar depender del allow-list de "Redirect URLs" del dashboard de Supabase, que causó el bug
real de KAN-342).

Ese trade-off no es gratis: a diferencia del fragment, un query param sí puede terminar en logs de
acceso del servidor/CDN y en el header `Referer` de cualquier request saliente que dispare la
página post-login (ej. si `/admin` carga un recurso de un origen distinto antes de que
`window.history.replaceState` limpie la URL). Dos motivos por los que se acepta igual:

- **El token es de un solo uso.** `token_hash` se canjea con `supabase.auth.verifyOtp` server-side
  (`adminRoutes.ts#exchange-token`, línea ~194) — es una operación de login de Supabase: la
  primera llamada exitosa invalida el `token_hash` (Supabase responde "Token has expired or is
  invalid" en cualquier intento posterior). Que el token quede en un log no habilita una sesión
  nueva una vez que el admin real ya lo canjeó; solo hay ventana de abuso si alguien con acceso al
  log lo usa _antes_ que el destinatario legítimo abra el email.
- **`window.history.replaceState` limpia la URL apenas se lee el query param** (mismo patrón que
  el tenant con el hash), así que el token no persiste en el historial del browser ni en
  bookmarks, aunque sí puede haber quedado ya en un log de acceso antes de esa limpieza (la
  request al servidor con el query param completo ya ocurrió).

Riesgo aceptado, no mitigado del todo: cualquier proceso con acceso a logs de acceso/CDN entre el
envío del email y el momento en que el admin lo abre podría canjear el token primero (carrera). Se
acepta porque el panel admin es de bajo volumen (allowlist chica, KAN-239) y el link expira rápido
(TTL default de Supabase); no se prioriza sobre el fix del bug real de KAN-342. Seguimiento
posible si esto se vuelve un problema: mover el `token_hash` al fragment también en el flujo admin
una vez que el link se sirva desde una página estática propia (hoy no es viable sin volver a
depender del `action_link` hosteado de Supabase, que es justamente lo que KAN-342 evitó).
