"use client";

/**
 * Hook `useProperties` (KAN-240) — estado del listado paginado + búsqueda de propiedades del
 * panel admin. Port de `matchouse/src/admin-dashboard/app.js` (`state`/`loadProperties`, líneas
 * 7-13 y 148-224): mismo debounce de búsqueda (350ms) y el mismo reset de página a 1 al cambiar
 * el término de búsqueda.
 *
 * A diferencia del legacy, no distingue 401/403 para mostrar "sesión expirada" acá — eso ya lo
 * resuelve el interceptor global de `apiClient`/`AdminAuthProvider` (KAN-239), este hook solo
 * necesita exponer el error tal cual.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "./api-client";
import { getProperties, type AdminProperty } from "./properties-api";

const SEARCH_DEBOUNCE_MS = 350;

export type PropertiesStatus = "loading" | "loaded" | "error";

export interface UsePropertiesResult {
  status: PropertiesStatus;
  properties: AdminProperty[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  search: string;
  error: string | null;
  setSearch: (value: string) => void;
  nextPage: () => void;
  prevPage: () => void;
}

export function useProperties(): UsePropertiesResult {
  const [status, setStatus] = useState<PropertiesStatus>("loading");
  const [properties, setProperties] = useState<AdminProperty[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [search, setSearchState] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchProperties = useCallback(async (fetchPage: number, fetchSearch: string) => {
    setStatus("loading");
    try {
      const res = await getProperties({ page: fetchPage, search: fetchSearch || undefined });
      if (!isMountedRef.current) return;
      setProperties(res.properties);
      setPage(res.page);
      setPageSize(res.pageSize);
      setTotal(res.total);
      setStatus("loaded");
      setError(null);
    } catch (err) {
      if (!isMountedRef.current) return;
      const message =
        err instanceof ApiError ? err.message : "No se pudieron cargar las propiedades.";
      setError(message);
      setStatus("error");
    }
  }, []);

  // Carga inicial, sin debounce. Mismo patrón (IIFE async dentro del efecto) que
  // useMatches/useActiveSearches para no disparar setState de forma sincrónica en el cuerpo del
  // efecto.
  useEffect(() => {
    void (async () => {
      await fetchProperties(1, "");
    })();
  }, [fetchProperties]);

  // Debounce manual con setTimeout (mismo mecanismo que `searchDebounce` en el legacy
  // `app.js`) — se limpia el timer pendiente tanto en cada tecla nueva como al desmontar.
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  const setSearch = useCallback(
    (value: string) => {
      setSearchState(value);
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = setTimeout(() => {
        void fetchProperties(1, value.trim());
      }, SEARCH_DEBOUNCE_MS);
    },
    [fetchProperties],
  );

  const nextPage = useCallback(() => {
    if (page >= Math.max(1, Math.ceil(total / pageSize))) return;
    void fetchProperties(page + 1, search);
  }, [page, total, pageSize, search, fetchProperties]);

  const prevPage = useCallback(() => {
    if (page <= 1) return;
    void fetchProperties(page - 1, search);
  }, [page, search, fetchProperties]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  return {
    status,
    properties,
    page,
    pageSize,
    total,
    totalPages,
    search,
    error,
    setSearch,
    nextPage,
    prevPage,
  };
}
