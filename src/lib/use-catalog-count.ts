"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getCatalogInfo } from "./catalog-api";

export type CatalogCountStatus = "loading" | "loaded" | "error";

export interface UseCatalogCountResult {
  status: CatalogCountStatus;
  count: number;
  refetch: () => Promise<void>;
}

/** Cantidad total de propiedades del tenant (`GET /api/catalog`) — alimenta la card de métrica "Propiedades". */
export function useCatalogCount(): UseCatalogCountResult {
  const [status, setStatus] = useState<CatalogCountStatus>("loading");
  const [count, setCount] = useState(0);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const refetch = useCallback(async () => {
    try {
      const info = await getCatalogInfo();
      if (!isMountedRef.current) return;
      setCount(info.count);
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

  return { status, count, refetch };
}
