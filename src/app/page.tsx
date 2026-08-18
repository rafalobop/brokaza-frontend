export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-zinc-50 px-6 text-center dark:bg-black">
      <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
        Brokaza
      </h1>
      <p className="max-w-md text-zinc-600 dark:text-zinc-400">
        Scaffold inicial (KAN-145). El dashboard de matching se implementa en los tickets siguientes
        de la Fase 0-2 del plan de migración.
      </p>
    </div>
  );
}
