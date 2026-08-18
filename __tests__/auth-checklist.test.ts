import { existsSync } from "node:fs";
import { join } from "node:path";
import { AUTH_FUNCTIONAL_PARITY_CHECKLIST } from "@/lib/auth-checklist";

const TESTS_DIR = join(__dirname);

const EXPECTED_ITEMS = [
  "Login por magic-link",
  "Expiración de sesión",
  "Logout",
  "Gate de perfil incompleto",
  "Manejo de 401 en medio de una sesión",
];

describe("AUTH_FUNCTIONAL_PARITY_CHECKLIST (KAN-169)", () => {
  it("cubre exactamente los 5 ítems de paridad funcional de MIGRATION_PLAN.md §8", () => {
    expect(AUTH_FUNCTIONAL_PARITY_CHECKLIST.map((entry) => entry.item)).toEqual(EXPECTED_ITEMS);
  });

  it("cada ítem tiene una subtarea de Jira única (KAN-180..KAN-184)", () => {
    const subtasks = AUTH_FUNCTIONAL_PARITY_CHECKLIST.map((entry) => entry.jiraSubtask);
    expect(subtasks).toEqual(["KAN-180", "KAN-181", "KAN-182", "KAN-183", "KAN-184"]);
    expect(new Set(subtasks).size).toBe(subtasks.length);
  });

  it.each(AUTH_FUNCTIONAL_PARITY_CHECKLIST)(
    "'$item' ($jiraSubtask) tiene referencia legacy, implementación y al menos un test",
    (entry) => {
      expect(entry.legacyReference.trim().length).toBeGreaterThan(0);
      expect(entry.implementedIn.length).toBeGreaterThan(0);
      expect(entry.newImplementation.length).toBeGreaterThan(0);
      expect(entry.verifiedBy.length).toBeGreaterThan(0);
    },
  );

  it("todos los archivos de test referenciados en verifiedBy existen realmente en __tests__/", () => {
    const allReferencedFiles = new Set(
      AUTH_FUNCTIONAL_PARITY_CHECKLIST.flatMap((entry) => entry.verifiedBy),
    );

    for (const file of allReferencedFiles) {
      expect(existsSync(join(TESTS_DIR, file))).toBe(true);
    }
  });

  it("todos los archivos de implementación referenciados existen realmente en el repo", () => {
    const repoRoot = join(__dirname, "..");
    const allReferencedFiles = new Set(
      AUTH_FUNCTIONAL_PARITY_CHECKLIST.flatMap((entry) => entry.newImplementation),
    );

    for (const file of allReferencedFiles) {
      expect(existsSync(join(repoRoot, file))).toBe(true);
    }
  });
});
