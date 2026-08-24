import { PageHeader } from "@/components/shell/PageHeader";
import { UploadDropzone } from "@/components/upload/UploadDropzone";
import { PropertiesTable } from "@/components/properties/PropertiesTable";

export default function PropiedadesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Propiedades"
        description="Cargá tu cartera en Excel — se cruza automáticamente contra las búsquedas de otros agentes."
      />
      <UploadDropzone />
      <PropertiesTable />
    </div>
  );
}
