import { Loader } from "@/components/ui/Loader";

// KAN-330: fallback de Suspense de Next.js para el segmento raíz de `(dashboard)` (`/`) —
// se muestra durante la navegación mientras el chunk de la página carga, con el mismo alcance
// que su `error.tsx` (reemplaza solo el contenido; `DashboardShell` sigue montado porque vive
// en `(dashboard)/layout.tsx`, por encima de este boundary).
export default function Loading() {
  return <Loader />;
}
