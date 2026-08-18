import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-zinc-50 px-6 text-center dark:bg-black">
      <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
        Página no encontrada
      </h1>
      <p className="max-w-md text-zinc-600 dark:text-zinc-400">
        La ruta que buscás no existe en el dashboard de Brokaza.
      </p>
      <Link href="/" className="mt-2 text-sm font-medium underline underline-offset-4">
        Volver al inicio
      </Link>
    </div>
  );
}
