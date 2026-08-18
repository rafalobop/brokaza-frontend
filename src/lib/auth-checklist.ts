/**
 * Checklist de paridad funcional del módulo Auth (KAN-169), requisito de
 * MIGRATION_PLAN.md §8 antes de dar por cerrada la Fase 1 y habilitar el
 * retiro del legacy correspondiente (gate de KAN-185). No es una pantalla —
 * es la fuente de verdad que referencia, para cada ítem del checklist, dónde
 * vive el comportamiento legacy, dónde quedó la implementación nueva, y qué
 * test automatizado lo prueba. `auth-checklist.test.ts` verifica que cada
 * referencia a un archivo de test exista realmente en el repo, así que este
 * módulo no puede quedar desincronizado con la suite sin que falle CI.
 */

export interface AuthChecklistItem {
  /** Key de la subtarea de Jira que trackea la verificación de este ítem. */
  jiraSubtask: string;
  /** Descripción del ítem, tal como aparece en MIGRATION_PLAN.md §8. */
  item: string;
  /** Ticket(s) de la Fase 1 que implementaron este ítem. */
  implementedIn: string[];
  /** Comportamiento equivalente en el dashboard legacy (matchouse), o por qué no aplica. */
  legacyReference: string;
  /** Archivos nuevos donde vive la implementación en brokaza-frontend. */
  newImplementation: string[];
  /** Archivos de test (relativos a `__tests__/`) que cubren este ítem. */
  verifiedBy: string[];
}

export const AUTH_FUNCTIONAL_PARITY_CHECKLIST: AuthChecklistItem[] = [
  {
    jiraSubtask: "KAN-180",
    item: "Login por magic-link",
    implementedIn: ["KAN-166"],
    legacyReference:
      "matchouse/src/dashboard/app.js líneas 592-643 (envío del magic link) y 403-457 (parsing del callback con el token en el hash).",
    newImplementation: ["src/components/auth/LoginForm.tsx", "src/lib/auth-context.tsx"],
    verifiedBy: ["login-form.test.tsx", "auth-context.test.tsx"],
  },
  {
    jiraSubtask: "KAN-181",
    item: "Expiración de sesión",
    implementedIn: ["KAN-160", "KAN-168"],
    legacyReference:
      "matchouse/src/routes/auth.ts GET /api/auth/session — nunca devuelve 401, siempre 200 con authenticated:false; el legacy no distinguía \"nunca logueado\" de \"sesión vencida\" en el bootstrap.",
    newImplementation: ["src/lib/auth-context.tsx"],
    verifiedBy: ["auth-context.test.tsx"],
  },
  {
    jiraSubtask: "KAN-182",
    item: "Logout",
    implementedIn: ["KAN-160", "KAN-168"],
    legacyReference:
      "src/admin-dashboard/app.js — apiFetch('/api/auth/logout', ...).catch(() => {}), best-effort, limpia el estado local sin importar el resultado de la red.",
    newImplementation: ["src/lib/auth-context.tsx"],
    verifiedBy: ["auth-context.test.tsx", "session-message.test.tsx"],
  },
  {
    jiraSubtask: "KAN-183",
    item: "Gate de perfil incompleto",
    implementedIn: ["KAN-167"],
    legacyReference:
      "N/A — funcionalidad introducida en el pivot a matching 100% web (KAN-64, matchouse). El dashboard legacy de WhatsApp no tenía un gate equivalente; se valida contra el contrato ya existente de POST/GET /api/profile.",
    newImplementation: [
      "src/lib/profile-context.tsx",
      "src/components/profile/ProfileGate.tsx",
      "src/components/profile/CompleteProfileForm.tsx",
    ],
    verifiedBy: ["profile-context.test.tsx", "profile-gate.test.tsx"],
  },
  {
    jiraSubtask: "KAN-184",
    item: "Manejo de 401 en medio de una sesión",
    implementedIn: ["KAN-160", "KAN-162", "KAN-168"],
    legacyReference:
      "matchouse/src/dashboard/app.js líneas 160-178 — monkey-patch invisible de window.fetch que deslogueaba ante cualquier 401.",
    newImplementation: ["src/lib/auth-events.ts", "src/lib/api-client.ts", "src/lib/auth-context.tsx"],
    verifiedBy: ["auth-events.test.ts", "api-client.test.ts", "auth-context.test.tsx", "session-message.test.tsx"],
  },
];
