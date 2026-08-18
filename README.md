# brokaza-frontend

Frontend de Brokaza en Next.js (App Router) + TypeScript. Reemplaza gradualmente a los dashboards estáticos servidos hoy por Express (`src/dashboard`, `src/admin-dashboard`) en el repo `brokaza` (backend). El contexto completo de la migración, prioridades por módulo y roadmap vive en `MIGRATION_PLAN.md` (KAN-143) de ese repo — este es un repo separado, así que no hay una ruta relativa a ese documento; consultarlo ahí.

**Estado actual (KAN-145):** solo scaffold. No hay lógica de negocio portada todavía — eso llega en los tickets siguientes de la Fase 0 (KAN-150, KAN-155, KAN-160) y de las fases posteriores.

**Repo separado del backend a propósito (decisión posterior a KAN-145):** aunque la Fase 0 del plan de migración despliega este frontend con _rewrites_ same-origin hacia Express (menor riesgo inicial, evita resolver CORS/cookies cross-origin de entrada), se optó por separar el repo desde el arranque en vez de esperar a la Fase 5 (retiro del legacy) — el costo de partir un monorepo crece con el tiempo (historia de git mezclada, CI acoplado, tooling compartido que hay que desenredar), y separarlo ya evita pagar ese costo después. El proxy/rewrites de KAN-150 sigue siendo necesario y no cambia por esto — sigue resolviendo el problema de cookies same-origin entre dos despliegues distintos, solo que ahora también entre dos repos distintos.

## Stack

- **Next.js 16** (App Router, Turbopack)
- **TypeScript** en modo estricto (heredado del preset de `create-next-app`)
- **Tailwind CSS v4** para estilos
- **ESLint** (`eslint-config-next`) + **Prettier** (con `prettier-plugin-tailwindcss` para ordenar clases automáticamente)
- **pnpm** como package manager (versión pineada en `package.json#packageManager`)

## Requisitos

- Node 22+
- pnpm (corepack lo resuelve automáticamente a partir de `packageManager` en `package.json`)

## Getting started

```bash
pnpm install
pnpm dev
```

Abrí [http://localhost:3000](http://localhost:3000).

## Scripts

| Script              | Qué hace                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`          | Servidor de desarrollo con hot reload.                                                                                                                                                                                                                                                                                                                                                               |
| `pnpm build`        | Build de producción. Incluye type-check completo del proyecto (`next build` corre `tsc` internamente sobre todo el árbol, no solo los archivos tocados).                                                                                                                                                                                                                                             |
| `pnpm start`        | Sirve el build de producción ya generado.                                                                                                                                                                                                                                                                                                                                                            |
| `pnpm lint`         | ESLint sobre todo el proyecto.                                                                                                                                                                                                                                                                                                                                                                       |
| `pnpm typecheck`    | `tsc --noEmit` standalone. **Requiere haber corrido `pnpm dev` o `pnpm build` al menos una vez antes** — Next.js genera tipos globales del App Router (p. ej. `LayoutProps`) en `.next/types/`, y sin ese directorio `tsc` falla con `Cannot find name 'LayoutProps'` aunque el código esté bien. En CI no se usa este script por esta razón — el type-check real ocurre como parte de `pnpm build`. |
| `pnpm format`       | Formatea todo el proyecto con Prettier.                                                                                                                                                                                                                                                                                                                                                              |
| `pnpm format:check` | Verifica formato sin escribir — el que corre CI.                                                                                                                                                                                                                                                                                                                                                     |

## Convenciones

- **App Router únicamente** — no se usa el Pages Router (`pages/`) en ningún caso nuevo.
- **`src/` como raíz de código** (`src/app`, y a medida que se agreguen: `src/components`, `src/lib`, `src/hooks`). Alias de import: `@/*` → `src/*` (configurado en `tsconfig.json`).
- **Server Components por defecto.** Un componente pasa a Client Component (`"use client"`) solo cuando necesita interactividad, hooks de estado/efectos, o APIs del navegador — no por defecto ni "por las dudas".
- **Formato es responsabilidad de Prettier, no de ESLint.** `eslint-config-prettier` apaga toda regla de estilo de ESLint que compita con Prettier — si un cambio "rompe el lint" por espaciado/comillas/etc., el fix es `pnpm format`, no editar reglas de ESLint.
- **Clases de Tailwind ordenadas automáticamente** vía `prettier-plugin-tailwindcss` al correr `pnpm format` — no reordenar clases a mano.
- Antes de portar cualquier módulo de complejidad **Alta** según `MIGRATION_PLAN.md` §6 del repo backend (Auth, UI de Matches), corresponde un mini-diseño escrito y revisado antes de codear — no es opcional.

## Estructura de carpetas

```
brokaza-frontend/
├── src/
│   └── app/              # rutas del App Router (layout.tsx, page.tsx, route handlers)
├── public/                # assets estáticos servidos en la raíz
├── eslint.config.mjs       # config de ESLint (flat config)
├── .prettierrc.json        # config de Prettier
├── next.config.ts
└── tsconfig.json
```

A medida que se agregue código de negocio (a partir de KAN-150 en adelante), la convención es:

- `src/components/` — componentes de UI reutilizables, no ligados a una ruta.
- `src/lib/` — clientes de API, utilidades puras, tipos compartidos.
- `src/hooks/` — hooks de React reutilizables (p. ej. el hook de WebSocket de matches, portado desde `realtimeMatches.js`/`metrics.js` del legacy).

Ningún módulo de negocio se agrega todavía en KAN-145 — esta sección documenta el destino esperado, no estructura ya poblada.

## CI (GitHub Actions)

Workflow: `.github/workflows/ci.yml`. Se dispara en:

- Pull requests (a cualquier rama base)
- Push a `main`

Pasos, en orden (cualquiera que falle corta el pipeline):

1. `pnpm install --frozen-lockfile` — falla si `pnpm-lock.yaml` está desactualizado respecto a `package.json`, en vez de resolver versiones nuevas silenciosamente en CI.
2. `pnpm lint`
3. `pnpm format:check`
4. `pnpm build` — incluye el type-check completo (ver nota de `pnpm typecheck` arriba).

### Plan de contingencia de CI

- **Falla de `format:check` por un cambio de formato no intencional:** correr `pnpm format` localmente, commitear el resultado. No se ajustan las reglas de Prettier para "pasar" un diff puntual.
- **Falla de `pnpm install --frozen-lockfile` (lockfile desincronizado):** correr `pnpm install` localmente (sin `--frozen-lockfile`) para regenerar `pnpm-lock.yaml`, revisar el diff del lockfile, y commitearlo junto con el cambio de dependencias que lo causó.
- **Falla de install por política de supply-chain de pnpm (`ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION` / trust downgrade):** `pnpm-workspace.yaml` define `minimumReleaseAge: 2880` (2 días) — bloquea instalar paquetes publicados hace menos de 48h, y `trustPolicy: no-downgrade` + `trustPolicyIgnoreAfter: 525600` para no bloquear falsos positivos en paquetes viejos y estables. Si un `pnpm add` de un paquete recién publicado (p. ej. un patch de Next.js del mismo día) falla por esto, **no es un bug** — es la política funcionando. Esperar ~48h y reintentar, o fijar una versión anterior ya vetada del paquete. No bajar `minimumReleaseAge` a 0 ni sacar `trustPolicy` para "destrabar" un install puntual.
- **Falla de build por error de tipos que no reproduce en local:** confirmar que la versión de Node en CI (22, fijada en el workflow) coincide con la local (`node -v`); si difiere, es la primera sospechosa antes de asumir un bug de TypeScript.
- **El workflow no se dispara en un PR:** al ser repo dedicado (sin `paths` filtrando por carpeta), cualquier push/PR lo dispara siempre — si no corrió, el problema es de permisos de Actions en el repo o de la config del workflow, no de un filtro de paths mal armado.
- **CI caído por causas ajenas al código (outage de GitHub Actions, timeout de red al resolver el registry de pnpm):** no hay override manual del gate de CI en este repo — se espera a que el servicio se recupere y se re-corre el job (`Re-run jobs` en la UI de Actions). No mergear sin un run verde.

## Deploy

Todavía no definido — depende de cómo se resuelva el proxy same-origin hacia Express de KAN-150 (rewrites de Next.js). No asumir Vercel ni ningún proveedor específico hasta que ese ticket lo defina.
