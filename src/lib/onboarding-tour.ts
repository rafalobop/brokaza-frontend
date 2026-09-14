import type { Step, Tour } from "nextstepjs";
import type { SidebarNavItem } from "@/components/shell/Sidebar";
import { navItemStepId } from "@/components/shell/Sidebar";

/** Nombre único del tour — lo usan `startNextStep(ONBOARDING_TOUR_NAME)` y los logs de nextstepjs. */
export const ONBOARDING_TOUR_NAME = "dashboard-intro";

const ONBOARDING_STORAGE_KEY = "brokaza:onboarding-seen";

/** Texto de cada pestaña del sidebar, independiente de si el usuario es owner o colaborador. */
const NAV_ITEM_DESCRIPTIONS: Record<string, string> = {
  "/": "Un resumen rápido de tu actividad reciente en la agencia.",
  "/propiedades":
    "Cargá y administrá tu cartera: cada propiedad se cruza automáticamente contra las búsquedas activas.",
  "/matches": "Acá te enterás cuando alguien se interesó en una de tus propiedades.",
  "/busquedas":
    "Registrá lo que buscan tus clientes para que el sistema te avise apenas aparezca un match.",
  "/equipo": "Invitá colaboradores a tu agencia y gestioná sus roles.",
};

/**
 * `id`s de los elementos "cómo se usa" dentro de cada pestaña — el tour los apunta como target de
 * sus sub-pasos. Viven acá (no inventados ad-hoc en cada página) para que el paso del tour y el
 * `id` del DOM real no se desincronicen.
 */
export const ONBOARDING_STEP_IDS = {
  resumenSearch: "onboarding-resumen-search",
  propiedadesUpload: "onboarding-propiedades-upload",
  propiedadesTable: "onboarding-propiedades-table",
  matchesList: "onboarding-matches-list",
  busquedasForm: "onboarding-busquedas-form",
  busquedasList: "onboarding-busquedas-list",
  equipoInvite: "onboarding-equipo-invite",
  equipoList: "onboarding-equipo-list",
} as const;

type SubStep = Pick<Step, "title" | "content" | "side">;

/** Sub-pasos de "cómo trabajar" dentro de cada pestaña, mostrados después del paso de sidebar. */
const PAGE_SUBSTEPS: Record<string, SubStep[]> = {
  "/": [
    {
      title: "Nueva búsqueda",
      content: "También podés cargar una búsqueda nueva sin salir del resumen.",
      side: "top",
    },
  ],
  "/propiedades": [
    {
      title: "Cargar cartera",
      content: "Arrastrá tu Excel de cartera acá (o hacé click) para cargar propiedades en bloque.",
      side: "bottom",
    },
    {
      title: "Tu cartera",
      content: 'Así se ve tu cartera cargada. Usá "Agregar propiedad" para sumar una a mano.',
      side: "top",
    },
  ],
  "/matches": [
    {
      title: "Interesados",
      content:
        "Cada fila trae los datos de contacto del agente interesado — hacé click para ver el detalle.",
      side: "top",
    },
  ],
  "/busquedas": [
    {
      title: "Nueva búsqueda",
      content:
        "Describí en texto libre lo que busca tu cliente y lo cruzamos con la cartera de otros agentes.",
      side: "bottom",
    },
    {
      title: "Tus búsquedas",
      content: "Acá seguís el estado de cada búsqueda: activas, vencidas o archivadas.",
      side: "top",
    },
  ],
  "/equipo": [
    {
      title: "Invitar colaborador",
      content:
        "Invitá a un colaborador con su email — le llega un magic link para sumarse a tu agencia.",
      side: "bottom",
    },
    {
      title: "Tu equipo",
      content: "Gestioná el acceso de tu equipo: revocá o reactivá cuando haga falta.",
      side: "top",
    },
  ],
};

/** Selector correspondiente a cada sub-paso, en el mismo orden que `PAGE_SUBSTEPS`. */
const PAGE_SUBSTEP_SELECTORS: Record<string, string[]> = {
  "/": [ONBOARDING_STEP_IDS.resumenSearch],
  "/propiedades": [ONBOARDING_STEP_IDS.propiedadesUpload, ONBOARDING_STEP_IDS.propiedadesTable],
  "/matches": [ONBOARDING_STEP_IDS.matchesList],
  "/busquedas": [ONBOARDING_STEP_IDS.busquedasForm, ONBOARDING_STEP_IDS.busquedasList],
  "/equipo": [ONBOARDING_STEP_IDS.equipoInvite, ONBOARDING_STEP_IDS.equipoList],
};

/** Un paso del tour más la ruta en la que su selector existe (`undefined` = cualquier ruta). */
interface RoutedStep extends Omit<Step, "nextRoute" | "prevRoute"> {
  route?: string;
}

/**
 * Arma el tour de bienvenida a partir de los `navItems` reales del sidebar (ya filtrados por rol
 * en `(dashboard)/layout.tsx`) — así un colaborador nunca ve un paso apuntando a "Equipo", que ni
 * siquiera está en su DOM.
 *
 * Estructura: bienvenida -> por cada pestaña, [paso de sidebar, sub-pasos de "cómo se usa" dentro
 * de esa página]. `nextRoute`/`prevRoute` no se escriben a mano paso por paso — se derivan
 * comparando la `route` de cada paso con la del siguiente/anterior (`toSteps` más abajo), así un
 * paso solo dispara navegación cuando el próximo/anterior en verdad vive en otra página.
 */
export function buildOnboardingTour(navItems: SidebarNavItem[]): Tour[] {
  const routedSteps: RoutedStep[] = [
    {
      icon: "👋",
      title: "Bienvenido a Brokaza",
      content: "Te mostramos rápido para qué sirve cada sección del panel y cómo se usa.",
    },
    ...navItems.flatMap((item) => [
      {
        selector: `#${navItemStepId(item.href)}`,
        side: "right" as const,
        title: item.label,
        content: NAV_ITEM_DESCRIPTIONS[item.href] ?? "",
        route: item.href,
      },
      ...(PAGE_SUBSTEPS[item.href] ?? []).map((sub, index) => ({
        ...sub,
        selector: `#${PAGE_SUBSTEP_SELECTORS[item.href][index]}`,
        route: item.href,
      })),
    ]),
  ];

  return [{ tour: ONBOARDING_TOUR_NAME, steps: toSteps(routedSteps) }];
}

function toSteps(routedSteps: RoutedStep[]): Step[] {
  return routedSteps.map(({ route, ...step }, index) => {
    const prevRoute = routedSteps[index - 1];
    const nextRoute = routedSteps[index + 1];
    return {
      ...step,
      prevRoute: prevRoute && prevRoute.route !== route ? prevRoute.route : undefined,
      nextRoute: nextRoute && nextRoute.route !== route ? nextRoute.route : undefined,
    };
  });
}

/** `false` en el server (SSR) — el autostart solo corre en el cliente, tras montar. */
export function hasSeenOnboarding(): boolean {
  if (typeof window === "undefined") return true;
  return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) === "1";
}

export function markOnboardingSeen(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "1");
}
