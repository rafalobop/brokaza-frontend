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
}

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
  }, [refetch]);

  return { status, metrics, refetch };
}
