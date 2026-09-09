import { Loader } from "@/components/ui/Loader";

// KAN-330 — mismo alcance que `admin/error.tsx`: reemplaza solo el contenido de la página,
// `DashboardShell` (sidebar/topbar de admin) sigue montado porque vive en `admin/layout.tsx`.
export default function Loading() {
  return <Loader />;
}
