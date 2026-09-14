"use client";

// KAN-221: la página pasó a "use client" para poder coordinar `UploadDropzone` y
// `PropertiesTable` — apenas termina una subida de Excel se incrementa `refreshToken`, que
// `PropertiesTable` observa para refrescar el listado solo, sin que el agente tenga que recargar
// la página o navegar afuera y volver para ver la cartera recién cargada.

import { useState } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { UploadDropzone } from "@/components/upload/UploadDropzone";
import { PropertiesTable } from "@/components/properties/PropertiesTable";
import { ONBOARDING_STEP_IDS } from "@/lib/onboarding-tour";

export default function PropiedadesPage() {
  const [refreshToken, setRefreshToken] = useState(0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Propiedades"
        description="Cargá tu cartera en Excel — se cruza automáticamente contra las búsquedas de otros agentes."
      />
      <div id={ONBOARDING_STEP_IDS.propiedadesUpload}>
        <UploadDropzone onUploadSuccess={() => setRefreshToken((t) => t + 1)} />
      </div>
      <div id={ONBOARDING_STEP_IDS.propiedadesTable}>
        <PropertiesTable refreshToken={refreshToken} />
      </div>
    </div>
  );
}
