# Checklist de paridad funcional — módulo Upload (KAN-219)

**Protocolo:** §8 de `MIGRATION_PLAN.md` — _"Cada módulo migrado se entrega con un checklist
de paridad funcional contra el legacy, verificado antes de reemplazarlo"_ y _"Sign-off explícito
de QA por módulo antes de dar de baja el código legacy correspondiente"_. Este documento es el
checklist en sí; el sign-off de QA se registra en Jira (comentario de cierre de este ticket,
sesión `/qa`) y en §6 más abajo — el checklist es el insumo, no el sign-off.

**Nota sobre el AC del ticket:** el AC en Jira menciona un módulo `QAReview.js` — no existe en
ningún repo (ni `matchouse` ni `brokaza-frontend`); es texto genérico no correspondiente a esta
arquitectura, mismo patrón ya señalado en el checklist de Matches (KAN-192, `matches-parity-checklist.md`
§0) y en el AC de KAN-215 ("sistema de versiones para auditar"). Este documento sigue en cambio
el protocolo real de §8 de `MIGRATION_PLAN.md`, que sí aplica al proyecto.

**Alcance:** el módulo Upload completo — KAN-215 (contrato compartido de `MAPPING_FIELDS`),
KAN-216 (drag&drop + subida multipart), KAN-217 (modal de confirmación de mapeo), KAN-218 (barra
de progreso real vía WS) — contra el legacy de `matchouse/src/dashboard/app.js` (líneas 645-971).

## 1. Checklist de §8 (bullet "Upload")

| Ítem                                           | Legacy                                                                    | Nueva implementación                                                                                                     | Evidencia                                                                                                                             | Estado |
| ---------------------------------------------- | ------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Happy path (subida válida)                     | `handleFileUpload` (`app.js` L688-724), `POST /api/upload` → 200          | `useUpload().upload()` (`use-upload.ts`) + `UploadDropzone`                                                              | `use-upload.test.ts`, `upload-dropzone.test.tsx` (drag&drop y selector de archivo, ambos caminos)                                     | ✅     |
| Flujo de confirmación de mapeo manual (KAN-84) | Modal DOM manual (`app.js` L761-971), `POST /api/upload/confirm-mapping`  | `MappingConfirmModal` + `useUpload().confirmMapping()`                                                                   | `mapping-confirm-modal.test.tsx` (6 tests), `use-upload-confirm-mapping.test.ts` (3 tests), integración en `upload-dropzone.test.tsx` | ✅     |
| Error de tamaño de archivo excedido            | Sin manejo especial client-side, mensaje genérico del backend (413)       | `useUpload()` propaga `ApiError.message` del backend tal cual (límite real, no hardcodeado — mismo criterio que KAN-215) | `use-upload.test.ts` ("pasa a status=error con el mensaje del backend si la subida falla", caso 413 explícito)                        | ✅     |
| Errores parciales de parseo de precios         | `reportUploadSuccess` (`app.js` L726-743): preview de hasta 5 direcciones | `UploadDropzone` muestra el conteo agregado (`N con precio no reconocido`)                                               | `upload-dropzone.test.tsx` — **agregado en este ticket** (gap encontrado: no había test para `priceParseErrors` no vacío)             | ✅     |

## 2. Paridad por sub-feature (más allá del bullet mínimo de §8)

| Comportamiento legacy                                                      | Portado                     | Evidencia                                                                                         |
| -------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------- |
| Drag&drop en la zona designada                                             | ✅                          | `upload-dropzone.test.tsx` (`fireEvent.drop` real)                                                |
| Selector de archivo por click (incluye teclado, Enter/Space)               | ✅                          | `upload-dropzone.test.tsx`; `<button>` nativo (KAN-218 self-check) en vez de `div role="button"`  |
| Validación de extensión `.xlsx` client-side                                | ✅                          | `use-upload.test.ts` (rechaza sin llamar a `fetch`)                                               |
| `GET /api/upload/mapping-fields` en vez de `MAPPING_FIELDS` hardcodeado    | ✅ (mejora sobre el legacy) | `use-mapping-fields.test.ts`, `mapping-confirm-modal.test.tsx` (precarga de headers ya resueltos) |
| Selects por campo con precarga de la sugerencia heurística/IA              | ✅                          | `mapping-confirm-modal.test.tsx`                                                                  |
| Campos requeridos/ambiguos marcados visualmente                            | ✅                          | `mapping-confirm-modal.test.tsx`                                                                  |
| Validación de campos requeridos antes de confirmar (mensaje estandarizado) | ✅                          | `mapping-confirm-modal.test.tsx`                                                                  |
| Cancelar el modal vuelve a estado limpio ("Carga cancelada." en el legacy) | ✅                          | `upload-dropzone.test.tsx`                                                                        |
| Barra de progreso real (`upload_status` WS) — **no existía en el legacy**  | ✅ (feature nueva, KAN-218) | `upload-progress.test.ts`, `use-upload-progress.test.ts`, `upload-progress-bar.test.tsx`          |
| Debounce de actualizaciones de progreso                                    | ✅                          | `upload-progress.test.ts` (coalesce de ráfagas, `cancel()`)                                       |

## 3. Contrato de API — cambios explícitos y aprobados

A diferencia del checklist de Matches (KAN-192, sin cambios de contrato), el módulo Upload sí
sumó un endpoint nuevo del lado del backend, **decidido y aprobado explícitamente por el usuario
durante KAN-215** (no un cambio incidental):

- **Nuevo:** `GET /api/upload/mapping-fields` (`matchouse/src/routes/upload.ts`) — expone
  `EXCEL_MAPPING_FIELDS`/`REQUIRED_EXCEL_MAPPING_FIELDS`/`EXCEL_MAPPING_FIELDS_VERSION`. Público,
  sin `tenantAuthMiddleware`. Documentado en `matchouse/docs/evolucion_proyecto/mapping_fields_contract.md`.
- **Sin cambios:** `POST /api/upload` y `POST /api/upload/confirm-mapping` (`matchouse/src/routes/upload.ts`)
  — verificado leyendo el código fuente del backend, no asumido.

## 4. Regresión de la suite

Estado de la suite completa de `brokaza-frontend` al momento de este checklist (rama `feature/KAN-219`):

```
Test Suites: 32 passed, 32 total
Tests:       214 passed, 214 total
tsc --noEmit: sin errores
eslint .: sin errores
```

(Reproducible con `npx jest && npx tsc --noEmit && npx eslint .` desde la raíz de `brokaza-frontend`.)

## 5. Fuera de alcance de este checklist

- **Retiro del código legacy** (`matchouse/src/dashboard/`) — Fase 5 (KAN-258), no este ticket.
  Este checklist es el insumo que habilita ese retiro más adelante, no lo ejecuta.
- **E2E real contra un backend Express corriendo con sesión activa** — no disponible en este
  entorno de desarrollo. Toda la evidencia de §1/§2 es de tests unitarios/de componente con
  mocks de `apiClient`/`fetch`/`WebSocket`, no de un browser real contra el backend. Señalado
  explícitamente en los comentarios de cierre de KAN-216/217/218 como recomendación pendiente:
  subir un `.xlsx` real, forzar un mapeo ambiguo real, y un archivo que exceda el límite real de
  tamaño, contra el backend desplegado.
- **Modal de confirmación de mapeo con más de una hoja pendiente simultánea en un Excel real**
  — cubierto en tests con 1-2 hojas sintéticas; no verificado con un archivo multi-hoja real.

## 5.1 Hallazgo de QA — dependencia de backend sin mergear (bloqueante para el happy path real)

Verificado en la sesión de QA (`/qa KAN-219`, no asumido): al momento de este checklist, el commit
que agrega `GET /api/upload/mapping-fields` (`432997e`, KAN-215) vive únicamente en
`matchouse/feature/KAN-215` — **no está mergeado a `matchouse/development`** (`git log
origin/feature/KAN-215` lo tiene, `git log development` no). `src/routes/upload.ts` en
`development` solo expone `POST /api/upload`, `POST /api/upload/confirm-mapping` y `GET
/api/catalog`.

Efecto práctico: `useMappingFields()` (consumido por `MappingConfirmModal`) va a fallar contra
cualquier backend desplegado desde `development` hasta que se mergee `feature/KAN-215` — el modal
de confirmación de mapeo quedaría con `fieldsStatus: "error"` y los selects deshabilitados
indefinidamente. Los otros tres endpoints de Upload (`POST /api/upload`, `confirm-mapping`,
`GET /api/catalog`) sí están disponibles sin cambios.

**No bloquea el sign-off de este checklist** (es un checklist de paridad de código/tests del
frontend, ya cumplido), pero **sí es un pre-requisito operativo** antes de considerar el módulo
Upload utilizable end-to-end: mergear `matchouse/feature/KAN-215` a `development` (y desplegarlo)
antes de, o junto con, el despliegue de `brokaza-frontend`.

## 6. Sign-off

**Firmado por QA — 2026-08-19.**

Validación independiente en esta sesión (`/qa KAN-219`), sin confiar en los números reportados
por `@frontend`: se re-corrió `npx jest`, `npx tsc --noEmit` y `npx eslint .` desde cero sobre
`brokaza-frontend` (branch `development`) y se confirmaron los mismos resultados de §4
(**32/32 test suites, 214/214 tests, sin errores de tipo ni de lint**). Se verificó además que
los 8 archivos de test citados en §1/§2 existen en `__tests__/` con esos nombres exactos, y que
el test nuevo de `priceParseErrors` (gap cerrado por `@frontend` en este mismo ticket) pasa de
forma aislada.

El módulo Upload (KAN-215/216/217/218) queda con **sign-off de paridad funcional aprobado**
contra el legacy de `matchouse`, sujeto a las exclusiones explícitas de §5 y, en particular, al
**hallazgo bloqueante de §5.1**: `matchouse/feature/KAN-215` (el endpoint
`GET /api/upload/mapping-fields`) debe mergearse a `development` antes de desplegar
`brokaza-frontend` a un entorno que dependa de un backend real — sin eso, el modal de
confirmación de mapeo no funciona end-to-end aunque toda la cobertura de tests esté en verde.
Esto habilita, en el futuro, el retiro del código legacy correspondiente en la Fase 5 (KAN-258)
— sin que ese retiro sea parte de este ticket, y condicionado al merge de KAN-215 mencionado
arriba.
