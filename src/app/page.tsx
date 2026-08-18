"use client";

import { LoginForm } from "@/components/auth/LoginForm";
import { useAuth } from "@/lib/auth-context";

export default function Home() {
  const { status, tenant, logout } = useAuth();

  if (status === "loading") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 dark:bg-black">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Cargando...</p>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 px-6 dark:bg-black">
        <LoginForm />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 bg-zinc-50 px-6 text-center dark:bg-black">
      <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
        Brokaza
      </h1>
      <p className="max-w-md text-zinc-600 dark:text-zinc-400">
        Sesión iniciada como {tenant?.email}. El dashboard de matching se implementa en los
        tickets siguientes de la Fase 1-2 del plan de migración.
      </p>
      <button
        type="button"
        onClick={() => void logout()}
        className="mt-2 text-sm font-medium underline underline-offset-4"
      >
        Cerrar sesión
      </button>
    </div>
  );
}
