import { render, screen } from "@testing-library/react";
import DashboardRootLoading from "@/app/(dashboard)/loading";
import BusquedasLoading from "@/app/(dashboard)/busquedas/loading";
import EquipoLoading from "@/app/(dashboard)/equipo/loading";
import MatchesLoading from "@/app/(dashboard)/matches/loading";
import PropiedadesLoading from "@/app/(dashboard)/propiedades/loading";
import AdminLoading from "@/app/admin/loading";
import AdminPropiedadesLoading from "@/app/admin/propiedades/loading";

// KAN-330: un `loading.tsx` por cada segmento con `page.tsx` bajo `src/app/**`. Smoke test —
// confirma que cada uno monta sin tirar y usa el `Loader` de marca (mismo criterio de cobertura
// que el resto de los boundaries de este repo, que tampoco tienen tests dedicados más allá de
// "renderiza sin errores").
describe.each([
  ["(dashboard)/loading.tsx", DashboardRootLoading],
  ["(dashboard)/busquedas/loading.tsx", BusquedasLoading],
  ["(dashboard)/equipo/loading.tsx", EquipoLoading],
  ["(dashboard)/matches/loading.tsx", MatchesLoading],
  ["(dashboard)/propiedades/loading.tsx", PropiedadesLoading],
  ["admin/loading.tsx", AdminLoading],
  ["admin/propiedades/loading.tsx", AdminPropiedadesLoading],
])("%s", (_label, Loading) => {
  it("renderiza el Loader de marca sin tirar", () => {
    render(<Loading />);
    expect(screen.getByText("Cargando...")).toBeInTheDocument();
  });
});
