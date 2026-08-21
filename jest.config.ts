import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({
  dir: "./",
});

const config: Config = {
  coverageProvider: "v8",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
};

// KAN-241 (spike): `react-leaflet` 5 y su dependencia `@react-leaflet/core` se publican como ESM
// puro (sin build CJS) — Jest por default no transforma nada bajo node_modules, así que
// `import ... from "react-leaflet"` en un test rompe con "Unexpected token 'export'". `next/jest`
// YA resuelve el caso general (excluye `node_modules` salvo un allowlist propio, con soporte
// para la estructura anidada de pnpm en Windows/POSIX) — pero **descarta silenciosamente**
// cualquier `transformIgnorePatterns` pasado en el objeto `config` de arriba (verificado con
// `npx jest --showConfig`: el array queda exactamente igual con o sin la clave seteada ahí). La
// única forma real de extenderlo es post-procesar el config ya resuelto (es una función async
// porque `next/jest` necesita leer `next.config.ts` primero) e inyectar los dos paquetes en el
// mismo allowlist que ya arma para `geist`, reusando su regex probado en vez de escribir uno
// propio para la estructura de pnpm.
async function resolveJestConfig() {
  const nextJestConfig = await createJestConfig(config)();
  return {
    ...nextJestConfig,
    transformIgnorePatterns: (nextJestConfig.transformIgnorePatterns ?? []).map((pattern) =>
      typeof pattern === "string"
        ? pattern.replace(
            /\(geist\|/g,
            "(geist|react-leaflet|@react-leaflet\\+core|@react-leaflet[\\\\/]core|",
          )
        : pattern,
    ),
  };
}

export default resolveJestConfig;
