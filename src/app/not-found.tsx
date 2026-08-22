import Link from "next/link";

export default function NotFound() {
  return (
    <div className="bg-background flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
      <h1 className="font-heading text-foreground text-2xl font-bold tracking-tight">
        Página no encontrada
      </h1>
      <p className="text-text-secondary max-w-md">
        La ruta que buscás no existe en el dashboard de Brokaza.
      </p>
      <Link href="/" className="text-accent mt-2 text-sm font-medium underline underline-offset-4">
        Volver al inicio
      </Link>
    </div>
  );
}
