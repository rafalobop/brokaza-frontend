import Image from "next/image";

interface LoaderProps {
  label?: string;
  /** `true` para ocupar toda la altura disponible (gates de auth/perfil a página completa). Default `true`. */
  fullHeight?: boolean;
}

/**
 * Loader de marca — logo de Brokaza con un anillo girando alrededor. Reemplaza el texto plano
 * "Cargando..." en los momentos que pueden demorar (bootstrap de sesión, intercambio del token
 * de magic-link al volver del mail, chequeo de perfil).
 */
export function Loader({ label = "Cargando...", fullHeight = true }: LoaderProps) {
  return (
    <div
      className={`bg-background flex flex-col items-center justify-center gap-4 ${fullHeight ? "flex-1" : ""}`}
    >
      <div className="relative flex h-16 w-16 items-center justify-center">
        <span className="border-card-border border-t-accent absolute inset-0 animate-spin rounded-full border-2" />
        <Image
          src="/logo_brokaza.png"
          alt=""
          width={40}
          height={40}
          className="rounded-full object-cover"
          priority
        />
      </div>
      {label ? <p className="text-text-secondary text-sm">{label}</p> : null}
    </div>
  );
}
