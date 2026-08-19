"use client";

import { LoginForm } from "@/components/auth/LoginForm";
import { MatchesDashboard } from "@/components/matches/MatchesDashboard";
import { ProfileGate } from "@/components/profile/ProfileGate";
import { UploadDropzone } from "@/components/upload/UploadDropzone";
import { useAuth } from "@/lib/auth-context";

export default function Home() {
  const { status, tenant, logout, loggingOut } = useAuth();

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
    <ProfileGate>
      <div className="flex flex-1 flex-col items-center bg-zinc-50 dark:bg-black">
        <div className="flex w-full max-w-3xl flex-col items-center gap-1 px-4 pt-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
            Brokaza
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Sesión iniciada como {tenant?.email}.
          </p>
          <button
            type="button"
            onClick={() => void logout()}
            disabled={loggingOut}
            className="text-sm font-medium underline underline-offset-4 disabled:opacity-60"
          >
            {loggingOut ? "Cerrando sesión..." : "Cerrar sesión"}
          </button>
        </div>
        <div className="w-full max-w-3xl px-4 pt-6">
          <UploadDropzone />
        </div>
        <MatchesDashboard />
      </div>
    </ProfileGate>
  );
}
