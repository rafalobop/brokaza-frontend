"use client";

import { Building2, Search, TrendingUp, Users } from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { useAdminMetrics } from "@/lib/use-admin-metrics";

/** `/admin` (KAN-239/240) — Resumen: 4 cards de métrica reales desde `GET /admin/api/metrics`. */
export default function AdminPage() {
  const { status, metrics } = useAdminMetrics();
  const loading = status === "loading";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Resumen" description="Estado general de la plataforma Brokaza." />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          label="Propiedades"
          value={loading ? "…" : (metrics?.totalProperties ?? 0)}
          icon={Building2}
          href="/admin/propiedades"
        />
        <MetricCard
          label="Usuarios registrados"
          value={loading ? "…" : (metrics?.registeredUsers ?? 0)}
          icon={Users}
        />
        <MetricCard
          label="Usuarios activos"
          value={loading ? "…" : (metrics?.activeUsers ?? 0)}
          icon={TrendingUp}
          status={metrics?.activeUsersDefinition}
        />
        <MetricCard
          label="Matches totales"
          value={loading ? "…" : (metrics?.totalMatches ?? 0)}
          icon={Search}
        />
      </div>
    </div>
  );
}
