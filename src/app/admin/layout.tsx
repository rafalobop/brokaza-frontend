import { AdminAuthProvider } from "@/lib/admin-auth-context";

/**
 * Layout de `/admin` (KAN-239) — scoped a este subárbol, no al layout raíz: el tenant y el admin
 * nunca comparten sesión ni Provider (ver docs/admin-auth-design.md §3.4).
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminAuthProvider>{children}</AdminAuthProvider>;
}
