"use client";

/** `GET /admin/api/metrics` (matchouse/src/adminRoutes.ts) — alimenta las cards de métrica del Resumen admin. */

import { useCallback, useEffect, useRef, useState } from "react";
import { adminApiClient } from "./admin-api-client";

export interface AdminMetrics {
  totalMatches: number;
  registeredUsers: number;
  activeUsers: number;
  activeUsersDefinition: string;
  totalProperties: number;
  // KAN-342: quedaban sin consumir del lado del hook — el backend (adminRoutes.ts) ya las
  // devuelve desde KAN-59, la migración a Next.js (KAN-239/240) nunca las incorporó a la UI.
  agentsWithPortfolio: number;
  agentsWithSearch: number;
  // KAN-342: paridad con el legacy (`admin-dashboard/app.js`) — siguen siendo placeholders sin
  // dato real de billing; el legacy los mostraba como "Pendiente" cuando son `null`.
  mrr: number | null;
  churn: number | null;
  billingNote: string;
}

// KAN-342: mismo intervalo que el legacy (`admin-dashboard/app.js#METRICS_POLL_MS`, KAN-59 fijó
// 10s explícitamente vía AC) — se preserva para no regresar la frescura del panel de salud del piloto.
const METRICS_POLL_MS = 10000;

export type AdminMetricsStatus = "loading" | "loaded" | "error";

export interface UseAdminMetricsResult {
  status: AdminMetricsStatus;
  metrics: AdminMetrics | null;
  refetch: () => Promise<void>;
}

export function useAdminMetrics(): UseAdminMetricsResult {
  const [status, setStatus] = useState<AdminMetricsStatus>("loading");
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refetch = useCallback(async () => {
    try {
      const result = await adminApiClient<AdminMetrics>("/api/metrics");
      if (!isMountedRef.current) return;
      setMetrics(result);
      setStatus("loaded");
    } catch {
      if (!isMountedRef.current) return;
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await refetch();
    })();

    const intervalId = setInterval(() => {
      void refetch();
    }, METRICS_POLL_MS);
    return () => clearInterval(intervalId);
  }, [refetch]);

  return { status, metrics, refetch };
}
