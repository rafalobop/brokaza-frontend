# Protocolo de revisión: `dangerouslySetInnerHTML`

KAN-332 (auditoría, 2026-09-09). Estado al momento de este documento: **un único uso** en todo
`brokaza-frontend`, en `src/app/layout.tsx` (script sin-FOUC de tema claro/oscuro, KAN-256).

## Evaluación del uso actual

```tsx
<script dangerouslySetInnerHTML={{ __html: buildThemeInitScript() }} />
```

`buildThemeInitScript()` (`src/lib/theme.ts`) devuelve un string **100% estático**: la única
interpolación es `THEME_STORAGE_KEY`, una constante de módulo (`"matchouse-theme"`) fijada en
tiempo de compilación — no hay ningún dato de request, query param, prop, respuesta de API, ni
entrada de usuario en el string inyectado. No hay superficie de XSS: no existe ningún input
externo que un atacante pueda controlar para inyectar HTML/JS arbitrario a través de este código.

Es un patrón estándar de Next.js/React para scripts "sin-FOUC" que deben ejecutar antes del
primer paint (no pueden esperar a que se hidrate un bundle de React) — no hay alternativa sin
`dangerouslySetInnerHTML` que preserve esa propiedad.

**Conclusión: sin riesgo detectado, no requiere cambios.**

## Protocolo para cambios futuros

Antes de modificar `buildThemeInitScript()` o agregar cualquier `dangerouslySetInnerHTML` nuevo
en el repo, quien lo toque debe confirmar y dejar constancia (comentario en el PR o en el código)
de lo siguiente:

1. **¿De dónde sale el string interpolado?** Si incluye cualquier valor que no sea una constante
   fijada en el código (props, query params, respuesta de API, `localStorage`/cookie leídos en
   runtime, texto de usuario, etc.), **no** es seguro pasarlo directo — hay que sanitizar
   explícitamente antes de interpolarlo (o, si es JSX normal, dejar que React escape por defecto —
   ver `ZoneBadge`/`escapeHtml` de KAN-136, portados a JSX en `src/components/admin/ZoneBadge.tsx`,
   ya no dependen del sanitizador manual del legacy retirado en KAN-342).
2. **¿Es realmente necesario `dangerouslySetInnerHTML`?** Si el contenido es texto plano o HTML
   controlado que React puede renderizar como JSX normal, usar JSX — `dangerouslySetInnerHTML`
   solo se justifica cuando hace falta HTML/script crudo que React no puede expresar de otra
   forma (como el script sin-FOUC de arriba).
3. **Dejar la evaluación por escrito** en un comentario junto al uso (mismo criterio que el de
   `layout.tsx`) explicando de dónde sale el contenido y por qué es seguro — no alcanza con que
   "hoy" sea seguro sin que quede documentado el motivo, para que la próxima persona que lo toque
   no tenga que re-auditarlo desde cero.
4. Si el nuevo uso **no** puede garantizar que el contenido es 100% estático o sanitizado, no
   mergear sin una revisión explícita de seguridad (mismo criterio que cualquier otro hallazgo de
   la auditoría `auditoria-brokaza`, ver `.agent/CONTEXT.md` en `matchouse`).
