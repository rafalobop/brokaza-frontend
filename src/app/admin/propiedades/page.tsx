import { PageHeader } from "@/components/shell/PageHeader";
import { PropertyList } from "@/components/admin/PropertyList";

export default function AdminPropiedadesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Propiedades"
        description="Listado paginado de toda la cartera — corrección de coordenadas incluida."
      />
      <PropertyList />
    </div>
  );
}
