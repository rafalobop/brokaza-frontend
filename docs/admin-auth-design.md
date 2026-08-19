# Mini-diseño — Auth del panel admin (KAN-239)

**Estado:** propuesta, pendiente de aprobación antes de implementar.

## 1. Por qué hace falta un mini-diseño (aunque el ticket esté marcado "Baja" en §12)

El AC de KAN-239 en Jira menciona un `UnifiedAuthAdapter`, "roles y permisos" y "KPIs de la
integración" — ninguno de esos conceptos existe en este proyecto (el admin real no tiene RBAC,
es un allowlist de emails contra una sola cookie `brokaza_admin_session`). Mismo patrón de AC
genérico/no aplicable ya señalado en KAN-215/219.

Más allá de eso, encontré una incompatibilidad real entre cómo el backend distingue tenant vs.
admin y cómo `brokaza-frontend` hace de proxy hoy:

- **Backend** (`matchouse/src/adminRoutes.ts#mountAdminRouter`): el panel admin es una rama
  *completamente separada* del pipeline de Express, activada solo cuando `req.hostname ===
  config.adminHost` (ej. `admin.brokaza.com`). Usa los **mismos paths** que el tenant
  (`/api/auth/request-magic-link`, `/api/auth/exchange-token`, `/api/auth/session`,
  `/api/auth/logout`), pero con su propia cookie (`brokaza_admin_session`, `sameSite: strict`) y
  su propia función de autorización (`isAllowedAdminEmail`/`isAllowedAdminUser`, allowlist, no
  self-signup).
- **Frontend** (`next.config.ts`, KAN-150): un único `rewrites()` reescribe `/api/:path*` hacia
  un solo `BACKEND_ORIGIN` fijo. Como el backend decide tenant-vs-admin por el **Host header** de
  la request que le llega, y Next.js arma ese Host a partir de la URL de destino (no del Host
  original del browser), **el proxy actual solo puede hablarle a uno de los dos routers a la
  vez** — hoy le habla al de tenants. No hay forma de que la misma request `/api/auth/session`
  llegue unas veces al router de tenant y otras al de admin sin alguna señal adicional.

## 2. Alternativas consideradas

| Opción | Cómo resuelve la colisión de Host | Complejidad | Descartada por |
|---|---|---|---|
| **A. Deploy separado** (segunda instancia de Next.js, su propio dominio, su propio `BACKEND_ORIGIN` apuntando al host admin) | Cada deploy tiene un solo `BACKEND_ORIGIN`, sin ambigüedad | Baja en código, alta en infraestructura (dos builds, dos dominios, dos configs de CI/CD) | Es exactamente lo que ya pasa en el legacy (`admin-dashboard/` servido aparte) — no es una migración real, es mantener dos apps. Fuera del espíritu de "una sola app Next.js" del resto del plan. |
| **B. Next.js Middleware con reescritura dinámica por Host** (`middleware.ts`, `NextResponse.rewrite` inspeccionando `request.headers.get('host')`) | Podría enrutar según el Host *entrante* al browser | Media | El problema no es enrutar según el Host entrante — es que el Host *saliente* hacia Express (derivado de la URL de destino) sigue siendo uno solo. Resolvería el ruteo interno de Next pero no la señal que necesita `adminRoutes.ts` para activar `adminRouter`, salvo que además reescriba el header saliente (no soportado de forma simple por `rewrites()`/`fetch` de Next en todos los entornos de despliegue). |
| **C. Prefijo de path `/admin/*`, con su propio `ADMIN_BACKEND_ORIGIN`** (recomendada) | Un segundo bloque en `rewrites()`: `/admin/api/:path*` → `${ADMIN_BACKEND_ORIGIN}/api/:path*`. En producción, `ADMIN_BACKEND_ORIGIN` apunta a la URL pública del host admin (`https://admin.brokaza.com`) — como es una URL absoluta con autoridad propia, el Host que le llega a Express en esa conexión es el del propio `ADMIN_BACKEND_ORIGIN`, que coincide con `config.adminHost` sin ningún truco adicional. | Baja | — (elegida) |

## 3. Diseño propuesto (Opción C)

### 3.1 Proxy (`next.config.ts`)

```ts
const backendOrigin = process.env.BACKEND_ORIGIN ?? "http://localhost:3000";
const adminBackendOrigin = process.env.ADMIN_BACKEND_ORIGIN ?? backendOrigin;

rewrites() {
  return [
    { source: "/admin/api/:path*", destination: `${adminBackendOrigin}/api/:path*` },
    { source: "/api/:path*", destination: `${backendOrigin}/api/:path*` },
    { source: "/internal/:path*", destination: `${backendOrigin}/internal/:path*` },
    { source: "/health", destination: `${backendOrigin}/health` },
  ];
}
```

El default `adminBackendOrigin = backendOrigin` es a propósito para no romper `pnpm dev` local
sin configuración extra — en local, sin `ADMIN_HOST` seteada en el backend, `mountAdminRouter` no
registra nada y esas rutas devuelven 404 igual, lo cual es el comportamiento actual sin cambios.
Para probar el flujo de login admin en local hace falta levantar el backend con `ADMIN_HOST`
apuntando a un hostname que resuelva a ese mismo backend (ej. vía `/etc/hosts` o un túnel) y
setear `ADMIN_BACKEND_ORIGIN` a esa URL — documentado en el README cuando se implemente.

### 3.2 Cliente HTTP (`src/lib/admin-api-client.ts`, nuevo)

Wrapper mínimo sobre `apiClient` (KAN-155) — literalmente "reusando el cliente unificado", que es
el AC real detrás del ruido del ticket:

```ts
export function adminApiClient<T>(path: string, options?: ApiClientOptions): Promise<T> {
  return apiClient<T>(`/admin${path}`, options);
}
```

Sin reimplementar timeout/abort/parsing/manejo de 401 — todo eso ya lo resuelve `apiClient`. El
único costo es el prefijo de path.

### 3.3 Estado de sesión (`src/lib/admin-auth-context.tsx`, nuevo)

Mismo patrón que `auth-context.tsx` (Context + `useReducer`, sin librería de estado nueva), pero
**no es el mismo Context** — la sesión de admin tiene una forma distinta (`{ email }` sin
`profile_completed` ni gate de perfil, ver `GET /api/auth/session` de `adminRoutes.ts` línea 165)
y un flujo de login sin el paso de "completar perfil" que sí tiene el tenant. Se separa en su
propio archivo/provider en vez de generalizar `AuthProvider` con un flag `isAdmin` — la lógica de
`consumeAuthCallbackHash` si es 100% reusable tal cual (mismo mecanismo de Supabase magic-link),
así que se importa de `auth-context.tsx` en vez de duplicarse.

**Nota sobre `auth-events.ts`:** el bus de eventos `emitUnauthorized`/`onUnauthorized` es un
singleton de módulo, compartido globalmente. Como tenant y admin nunca están montados en la misma
sesión de browser real (hosts distintos), esto no genera colisión en producción — se documenta
igual como advertencia conocida (ya existe una nota idéntica para el propio `auth-events.ts`
desde KAN-160/génesis de Fase 0).

### 3.4 Ruta y UI (`src/app/admin/`, nuevo)

- `src/app/admin/layout.tsx`: monta `<AdminAuthProvider>` (scoped a este subárbol, no en el
  layout raíz — el tenant y el admin nunca comparten sesión).
- `src/app/admin/page.tsx`: reusa la forma de `LoginForm` (mismo flujo de magic-link) más una
  vista mínima post-login ("Hola, {email}") — las vistas reales (métricas, listado de
  propiedades) son KAN-240/241/242, fuera de alcance de KAN-239.

### 3.5 Alcance explícito de KAN-239

Solo login (`request-magic-link` + `exchange-token` + callback), sesión (`session`) y logout —
igual que pide el AC real de §12 ("Auth del admin reusando el cliente unificado (Fase 0)"). Nada
de métricas/propiedades/Leaflet (KAN-240/241/242).

## 4. Riesgo aceptado / seguimiento

- El valor por defecto `ADMIN_BACKEND_ORIGIN = BACKEND_ORIGIN` significa que, si alguien
  despliega sin configurar la variable, las requests a `/admin/api/*` van al mismo origen que las
  de tenant — pero como el backend igual las descarta si `req.hostname !== config.adminHost`
  (devuelve 404 del pipeline de tenants, que no tiene esas rutas), el fallo es silencioso pero
  seguro (nunca expone el panel admin por accidente). Documentar esto explícitamente al configurar
  el deploy real es responsabilidad de la Fase 5 (retiro de legacy) / infraestructura, no de este
  ticket.
