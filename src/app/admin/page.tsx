"use client";

import {
  Briefcase,
  Building2,
  CircleDollarSign,
  Search,
  SearchCheck,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/shell/PageHeader";
import { MetricCard } from "@/components/ui/MetricCard";
import { NoTranslate } from "@/components/ui/NoTranslate";
import { useAdminMetrics } from "@/lib/use-admin-metrics";

/** `/admin` (KAN-239/240, +2 cards KAN-342) — Resumen: cards de métrica reales desde `GET /admin/api/metrics`. */
export default function AdminPage() {
  const { status, metrics } = useAdminMetrics();
  const loading = status === "loading";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Resumen"
        description={
          <>
            Estado general de la plataforma <NoTranslate>Brokaza</NoTranslate>.
          </>
        }
      />
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
        <MetricCard
          label="Agentes con cartera"
          value={loading ? "…" : (metrics?.agentsWithPortfolio ?? 0)}
          icon={Briefcase}
        />
        <MetricCard
          label="Agentes con búsqueda"
          value={loading ? "…" : (metrics?.agentsWithSearch ?? 0)}
          icon={SearchCheck}
        />
        <MetricCard
          label="MRR"
          value={loading ? "…" : (metrics?.mrr ?? "Pendiente")}
          icon={CircleDollarSign}
          status={metrics?.mrr == null ? metrics?.billingNote : undefined}
        />
        <MetricCard
          label="Churn"
          value={loading ? "…" : (metrics?.churn ?? "Pendiente")}
          icon={TrendingDown}
          status={metrics?.churn == null ? metrics?.billingNote : undefined}
        />
      </div>
    </div>
  );
}
