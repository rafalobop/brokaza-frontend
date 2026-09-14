# Guideline: superficie de dependencias mínima

KAN-333 (auditoría, 2026-09-09). Criterio para agregar dependencias de producción a
`brokaza-frontend` y auditoría del estado actual.

## Regla

**Máximo 6 librerías de producción**, sin contar el framework en sí (`next`, `react`,
`react-dom` — no son una elección del equipo, son la base sobre la que corre toda la app; sin
ellas no hay proyecto). El límite corre sobre lo que queda: cualquier paquete que el equipo
decide agregar a `dependencies` en `package.json` porque resuelve un problema puntual.

El objetivo es el mismo que ya aplicó este proyecto en otras decisiones de infraestructura (ver
`docs/rate-limit-backends.md` en `matchouse`, "no agregar infraestructura sin necesidad real"):
cada dependencia nueva es superficie de ataque, peso de bundle, y mantenimiento a futuro
(actualizaciones, breaking changes, vulnerabilidades). Un límite bajo obliga a preguntarse "¿esto
lo puedo resolver con lo que ya tengo, o con código propio de 20 líneas?" antes de sumar un
paquete.

## Por qué 6 y no otro número

El ticket original pedía "6 librerías en producción, incluyendo react-leaflet" contando también
el framework — con `next`/`react`/`react-dom` ya son 3, más `react-leaflet` como cuarta, dejaría
solo 2 lugares para todo lo demás (hoy ya hay `leaflet`, `lucide-react`, `@sentry/nextjs` además
de `react-leaflet`, es decir 7 en total). Ese criterio literal ya estaría incumplido el día que se
escribió el ticket, sin que hubiera ninguna dependencia de más que sacar — el framework no se
puede "eliminar" para cumplir un conteo. Se ajustó el criterio para que el límite recaiga sobre lo
que el equipo realmente controla (librerías más allá del framework), manteniendo la intención real
del ticket (mantener la superficie de dependencias chica y deliberada) sin pedir algo imposible.

## Auditoría de dependencias actuales (actualizado 2026-09-14)

Contadas para el límite (7 de 7 — límite subido de 6 a 7, ver `scripts/check-dependency-limit.mjs`):

| Paquete          | Versión  | Para qué                                                                                                                                                                                                    |
| ---------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@sentry/nextjs` | ^10.73.0 | Observabilidad de errores en producción, mismo pipeline de alertas que el backend (KAN-83/126 en `matchouse`).                                                                                              |
| `leaflet`        | ^1.9.4   | Motor de mapas — usado por la vista de matches/zonas (mismo mapa que el legacy, `matches-ui-design.md`).                                                                                                    |
| `lucide-react`   | ^1.33.0  | Set de iconos SVG, reemplazo del sprite de iconos del legacy.                                                                                                                                               |
| `react-leaflet`  | ^5.0.0   | Bindings de React sobre `leaflet` — va siempre junto a `leaflet` (par indisociable, no son dos decisiones independientes).                                                                                  |
| `cross-env`      | ^10.1.0  | Setea `NODE_ENV=production` de forma cross-platform en el script `start` (`server.ts` corre igual en CI/Windows/Linux).                                                                                     |
| `ts-node`        | ^10.9.2  | El `start` de producción ejecuta `server.ts` (custom server, necesario para el proxy de WebSocket) directo con ts-node, sin paso de compilación previo — por eso es dependencia de runtime, no solo de dev. |
| `typescript`     | ^5       | Peer requerido por `ts-node` para compilar `server.ts` al vuelo en producción (mismo motivo que la fila anterior).                                                                                          |

No contadas (framework core): `next`, `react`, `react-dom`.

**Margen actual: 0 dependencias antes de tocar el límite otra vez.** `cross-env`, `ts-node` y
`typescript` ya estaban en `dependencies` desde que se agregó el custom server (`server.ts`), pero
nunca se habían sumado a esta auditoría ni se había subido `MAX_LIBRARIES` en consecuencia — el
check quedó rompiendo el pipeline de CI en `main` hasta esta corrección.

## Validación automática

`scripts/check-dependency-limit.mjs` (paso "Dependency limit (KAN-333)" en
`.github/workflows/ci.yml`, disponible local con `pnpm run check:dependency-limit`) falla el build
si `dependencies` en `package.json` (excluyendo el framework core) supera las 6 librerías.

## Proceso para agregar una dependencia nueva

1. Antes de instalar, preguntarse: ¿esto se puede resolver sin una librería nueva (código propio,
   una API nativa del browser, algo que ya está en `node_modules` de otra dependencia)?
2. Si hace falta la librería igual, instalarla — si el conteo sigue en 6 o menos, no hay que hacer
   nada más además de esta guía.
3. Si el conteo pasa de 6, el PR **tiene que**:
   - Subir `MAX_LIBRARIES` en `scripts/check-dependency-limit.mjs`, con un comentario en el commit
     explicando qué resuelve la dependencia nueva y por qué no alcanzaba con lo que ya había.
   - Agregar una fila a la tabla de auditoría de arriba.
   - Eso hace que la excepción quede visible en el diff y en code review — no hay forma de que una
     dependencia de más se cuele en silencio, el CI la bloquea hasta que alguien haga ese cambio
     deliberado.

## Onboarding del equipo

Este documento **es** el material de referencia del guideline — se linkea desde el PR template o
el README de `brokaza-frontend` la primera vez que alguien necesite agregar una dependencia
nueva. Una capacitación sincrónica (reunión en vivo, walkthrough grabado) es una acción humana,
no algo que se resuelva con código — queda fuera de lo que esta tarea puede entregar; si el equipo
la quiere, el punto de partida es este documento.
