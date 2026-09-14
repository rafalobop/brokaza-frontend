#!/usr/bin/env node
// KAN-333: guardia de CI que impone el límite de superficie de dependencias definido en
// docs/dependency-management-guideline.md. Ver ese archivo para el criterio completo y la
// auditoría de las dependencias actuales.
//
// `FRAMEWORK_CORE` no cuenta para el límite: no son "librerías" que el equipo elige agregar
// libremente, son el framework mismo (sin `next`/`react`/`react-dom` no hay aplicación).
//
// Para agregar una dependencia de producción que empuje el conteo por encima de `MAX_LIBRARIES`,
// hay que subir el límite acá a mano, en el mismo PR, con un comentario que justifique el motivo
// (mismo criterio que cualquier otro cambio de config versionado) — así la excepción queda
// visible en el diff y en la revisión de código, no se puede colar en silencio.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgPath = path.join(__dirname, "..", "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

const FRAMEWORK_CORE = new Set(["next", "react", "react-dom"]);
// Subido de 6 a 7: `cross-env`, `ts-node` y `typescript` son dependencias de producción reales
// (el "start" script corre `cross-env NODE_ENV=production ts-node server.ts` — el custom server
// se ejecuta con ts-node directo, sin paso de compilación previo), pero nunca se habían sumado
// a la auditoría cuando se agregaron. Ver docs/dependency-management-guideline.md.
const MAX_LIBRARIES = 7;

const dependencies = Object.keys(pkg.dependencies ?? {});
const countedLibraries = dependencies.filter((name) => !FRAMEWORK_CORE.has(name));

if (countedLibraries.length > MAX_LIBRARIES) {
  console.error(
    `[check-dependency-limit] ${countedLibraries.length} librerías de producción ` +
      `(excluyendo ${[...FRAMEWORK_CORE].join("/")}), supera el límite de ${MAX_LIBRARIES}.`,
  );
  console.error(`Librerías contadas: ${countedLibraries.join(", ")}`);
  console.error(
    "Ver docs/dependency-management-guideline.md — si la nueva dependencia está justificada, " +
      "subí MAX_LIBRARIES acá mismo (scripts/check-dependency-limit.mjs) explicando el motivo " +
      "en el commit, y actualizá la auditoría del guideline.",
  );
  process.exit(1);
}

console.log(
  `[check-dependency-limit] OK — ${countedLibraries.length}/${MAX_LIBRARIES} librerías de producción.`,
);
