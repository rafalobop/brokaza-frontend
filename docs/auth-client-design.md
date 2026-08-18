# Mini-diseño: cliente de auth unificado (KAN-160 / gate KAN-161)

Complejidad Alta según MIGRATION_PLAN.md §6 — este documento es el gate obligatorio
antes de codear KAN-162/163/164.

## 1. Alcance de esta historia

Solo estado global de sesión + interceptor de 401 explícito. **No** incluye:

- UI de login por magic-link (request + parseo de callback + exchange) → KAN-166.
- Gate de "perfil incompleto" que bloquea el resto del dashboard → KAN-167.
- Persistencia de sesión entre tabs (`BroadcastChannel`) — el legacy tampoco lo
  tiene, no se agrega ahora.

## 2. Estado global: React Context + `useReducer`, sin librería externa

**Decisión:** Context API nativo, no Zustand/Redux/Jotai.

**Por qué:** el estado de auth es chico (status + datos del tenant), vive en un
único provider en la raíz del árbol, sin necesidad de selectors granulares ni
persistencia compleja que justifiquen una dependencia nueva. `react-state-management`
se evaluó como skill de contexto para esta tarea (es obligatoria para módulos de
Auth/Matches según MIGRATION_PLAN.md §11) y su propia guía recomienda Context+reducer
para este tamaño de estado — reservar una store externa para cuando el estado
crezca (ej. Matches, con más entidades y writes concurrentes).

```ts
type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface TenantSession {
  id: string;
  email: string;
}

interface AuthState {
  status: AuthStatus;
  tenant: TenantSession | null;
}
```

Acciones del reducer: `SESSION_LOADING`, `SESSION_RESOLVED(tenant | null)`,
`SESSION_CLEARED` (disparada tanto por el interceptor de 401 como por logout).

## 3. Interceptor de 401: pub/sub desacoplado, no un import de React en el cliente HTTP

El cliente de API (`src/lib/api-client.ts`, KAN-155) es agnóstico de framework a
propósito — no debe importar React ni conocer el contexto de auth (evita acoplar
la capa de transporte a la capa de UI y evita ciclos de import).

- **Nuevo módulo `src/lib/auth-events.ts`**: un event bus mínimo —
  `onUnauthorized(callback): () => void` (se suscribe y devuelve función de
  desuscripción) y `emitUnauthorized()`.
- **Cambio mínimo en `api-client.ts`**: en el branch donde arma
  `ApiError(kind: "http")`, si `response.status === 401`, llama a
  `emitUnauthorized()` antes de lanzar el error.
- **`AuthProvider`** se suscribe a `onUnauthorized` en un `useEffect` al montar
  y, ante el evento, hace `dispatch({ type: "SESSION_CLEARED" })`.

Esto reemplaza el monkey-patch invisible de `window.fetch` del legacy
(`src/dashboard/app.js` líneas 160-178) por un mecanismo explícito: vive en un
módulo con nombre, es testeable de forma aislada, y no depende de reasignar un
global.

## 4. Bootstrap de sesión

Al montar `AuthProvider`, llama `apiClient('/api/auth/session')`. Ese endpoint
(`src/routes/auth.ts:21`, matchouse) **siempre devuelve 200** —
`{ authenticated: boolean, tenant?: { id, email } }` — nunca 401, así que el
bootstrap en sí mismo no dispara el interceptor.

## 5. Logout

`logout()` expuesto por el contexto: llama
`apiClient('/api/auth/logout', { method: 'POST' })` en modo best-effort (catch
silencioso, igual que el `apiFetch(...).catch(() => {})` del admin legacy) y
siempre limpia el estado local (`SESSION_CLEARED`) sin importar el resultado de
la llamada de red.

## 6. Plan de testing (cubre el AC de KAN-163)

- `auth-events.ts`: emitir sin suscriptores no rompe; múltiples suscriptores
  reciben el evento; `unsubscribe` deja de recibirlo.
- `api-client.ts` + `auth-events.ts`: mock de `fetch` devolviendo 401 → se
  llama `emitUnauthorized`; una respuesta 403/500 no lo dispara.
- `AuthProvider`/`useAuth` (React Testing Library):
  - bootstrap con sesión válida → `status: "authenticated"`.
  - bootstrap sin sesión → `status: "unauthenticated"`.
  - **Caso KAN-163 — sesión expirada en medio de una sesión activa**: provider
    en `"authenticated"`, se dispara cualquier llamada que devuelve 401 → el
    hook pasa a `"unauthenticated"` sin recargar la página.
  - `logout()` limpia el estado incluso si la llamada de red al backend falla.

## 7. Archivos nuevos/tocados

- `src/lib/auth-events.ts` (nuevo)
- `src/lib/auth-context.tsx` (nuevo — `AuthProvider`, `useAuth`)
- `src/lib/api-client.ts` (modificado — una rama nueva que llama a
  `emitUnauthorized()` en 401)
- tests correspondientes en `__tests__/`
