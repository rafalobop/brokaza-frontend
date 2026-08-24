"use client";

/**
 * Hook `useTenantProperties` (KAN-273) — estado de la tabla interactiva de propiedades del propio
 * tenant: listado + filtros (`operation`/`property_type`/`search`) + orden por columna + alta,
 * edición y borrado, todo contra `/api/catalog/properties`. Mismo patrón de estado local (sin store
 * global) que `use-properties.ts`/`use-active-searches.ts` — debounce manual de 350ms en la
 * búsqueda, `isMountedRef` para no `setState` tras desmontar.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ApiError } from "./api-client";
import {
  createTenantProperty,
  deleteTenantProperty,
  getTenantProperties,
  updateTenantProperty,
  type CreatePropertyInput,
  type PropertyOperation,
  type PropertyType,
  type SortableField,
  type SortOrder,
  type TenantProperty,
  type UpdatePropertyInput,
} from "./tenant-properties-api";

const SEARCH_DEBOUNCE_MS = 350;
const PAGE_SIZE = 15;

export type TenantPropertiesStatus = "loading" | "loaded" | "error";

export interface TenantPropertiesFilters {
  operation: PropertyOperation | "";
  property_type: PropertyType | "";
  search: string;
}

export interface UseTenantPropertiesResult {
  status: TenantPropertiesStatus;
  properties: TenantProperty[];
  total: number;
  page: number;
  totalPages: number;
  error: string | null;
  filters: TenantPropertiesFilters;
  sort: SortableField;
  order: SortOrder;
  setOperationFilter: (value: PropertyOperation | "") => void;
  setPropertyTypeFilter: (value: PropertyType | "") => void;
  setSearch: (value: string) => void;
  setSort: (field: SortableField) => void;
  nextPage: () => void;
  prevPage: () => void;
  refresh: () => void;
  createProperty: (input: CreatePropertyInput) => Promise<void>;
  /**
   * Devuelve `{ conflict: TenantProperty }` cuando el backend responde 409 (alguien más editó la
   * fila desde que se leyó) — el caller decide cómo reconciliar (mostrar el valor actual, dejar
   * que el usuario reintente). Cualquier otro error se relanza.
   */
  updateProperty: (
    id: string,
    input: UpdatePropertyInput,
  ) => Promise<{ conflict: TenantProperty } | { conflict: null }>;
  deleteProperty: (id: string) => Promise<void>;
}

export function useTenantProperties(): UseTenantPropertiesResult {
  const [status, setStatus] = useState<TenantPropertiesStatus>("loading");
  const [properties, setProperties] = useState<TenantProperty[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [operation, setOperation] = useState<PropertyOperation | "">("");
  const [propertyType, setPropertyType] = useState<PropertyType | "">("");
  const [search, setSearchState] = useState("");
  const [sort, setSortState] = useState<SortableField>("created_at");
  const [order, setOrder] = useState<SortOrder>("desc");

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fetchProperties = useCallback(
    async (params: {
      fetchPage: number;
      fetchOperation: PropertyOperation | "";
      fetchPropertyType: PropertyType | "";
      fetchSearch: string;
      fetchSort: SortableField;
      fetchOrder: SortOrder;
    }) => {
      setStatus("loading");
      try {
        const res = await getTenantProperties({
          operation: params.fetchOperation || undefined,
          property_type: params.fetchPropertyType || undefined,
          search: params.fetchSearch || undefined,
          sort: params.fetchSort,
          order: params.fetchOrder,
          limit: PAGE_SIZE,
          offset: (params.fetchPage - 1) * PAGE_SIZE,
        });
        if (!isMountedRef.current) return;
        setProperties(res.properties);
        setTotal(res.total);
        setPage(params.fetchPage);
        setStatus("loaded");
        setError(null);
      } catch (err) {
        if (!isMountedRef.current) return;
        const message =
          err instanceof ApiError ? err.message : "No se pudieron cargar las propiedades.";
        setError(message);
        setStatus("error");
      }
    },
    [],
  );

  // Carga inicial. IIFE async (mismo patrón que useIncomingMatches/useProperties) en vez de
  // llamar fetchProperties directo en el cuerpo del efecto — evita el lint de "setState
  // sincrónico dentro de un efecto" (react-hooks/set-state-in-effect).
  useEffect(() => {
    void (async () => {
      await fetchProperties({
        fetchPage: 1,
        fetchOperation: "",
        fetchPropertyType: "",
        fetchSearch: "",
        fetchSort: "created_at",
        fetchOrder: "desc",
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar, igual que use-properties.ts
  }, []);

  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, []);

  const setOperationFilter = useCallback(
    (value: PropertyOperation | "") => {
      setOperation(value);
      void fetchProperties({
        fetchPage: 1,
        fetchOperation: value,
        fetchPropertyType: propertyType,
        fetchSearch: search,
        fetchSort: sort,
        fetchOrder: order,
      });
    },
    [propertyType, search, sort, order, fetchProperties],
  );

  const setPropertyTypeFilter = useCallback(
    (value: PropertyType | "") => {
      setPropertyType(value);
      void fetchProperties({
        fetchPage: 1,
        fetchOperation: operation,
        fetchPropertyType: value,
        fetchSearch: search,
        fetchSort: sort,
        fetchOrder: order,
      });
    },
    [operation, search, sort, order, fetchProperties],
  );

  const setSearch = useCallback(
    (value: string) => {
      setSearchState(value);
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = setTimeout(() => {
        void fetchProperties({
          fetchPage: 1,
          fetchOperation: operation,
          fetchPropertyType: propertyType,
          fetchSearch: value.trim(),
          fetchSort: sort,
          fetchOrder: order,
        });
      }, SEARCH_DEBOUNCE_MS);
    },
    [operation, propertyType, sort, order, fetchProperties],
  );

  const setSort = useCallback(
    (field: SortableField) => {
      // Clickear la misma columna invierte el orden; una columna nueva arranca en 'asc'.
      const nextOrder: SortOrder = field === sort && order === "asc" ? "desc" : "asc";
      setSortState(field);
      setOrder(nextOrder);
      void fetchProperties({
        fetchPage: 1,
        fetchOperation: operation,
        fetchPropertyType: propertyType,
        fetchSearch: search,
        fetchSort: field,
        fetchOrder: nextOrder,
      });
    },
    [sort, order, operation, propertyType, search, fetchProperties],
  );

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  const nextPage = useCallback(() => {
    if (page >= totalPages) return;
    void fetchProperties({
      fetchPage: page + 1,
      fetchOperation: operation,
      fetchPropertyType: propertyType,
      fetchSearch: search,
      fetchSort: sort,
      fetchOrder: order,
    });
  }, [page, totalPages, operation, propertyType, search, sort, order, fetchProperties]);

  const prevPage = useCallback(() => {
    if (page <= 1) return;
    void fetchProperties({
      fetchPage: page - 1,
      fetchOperation: operation,
      fetchPropertyType: propertyType,
      fetchSearch: search,
      fetchSort: sort,
      fetchOrder: order,
    });
  }, [page, operation, propertyType, search, sort, order, fetchProperties]);

  const refresh = useCallback(() => {
    void fetchProperties({
      fetchPage: page,
      fetchOperation: operation,
      fetchPropertyType: propertyType,
      fetchSearch: search,
      fetchSort: sort,
      fetchOrder: order,
    });
  }, [page, operation, propertyType, search, sort, order, fetchProperties]);

  const createProperty = useCallback(
    async (input: CreatePropertyInput) => {
      await createTenantProperty(input);
      // Alta nueva: vuelve a la página 1 para que la fila recién creada sea visible sin que el
      // usuario tenga que ir a buscarla en la paginación/orden actual.
      await fetchProperties({
        fetchPage: 1,
        fetchOperation: operation,
        fetchPropertyType: propertyType,
        fetchSearch: search,
        fetchSort: sort,
        fetchOrder: order,
      });
    },
    [operation, propertyType, search, sort, order, fetchProperties],
  );

  const updateProperty = useCallback(async (id: string, input: UpdatePropertyInput) => {
    try {
      const { property } = await updateTenantProperty(id, input);
      if (!isMountedRef.current) return { conflict: null };
      setProperties((prev) => prev.map((p) => (p.id === id ? property : p)));
      return { conflict: null };
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const conflictProperty = (err.body as { property?: TenantProperty } | undefined)?.property;
        if (conflictProperty) {
          if (isMountedRef.current) {
            setProperties((prev) => prev.map((p) => (p.id === id ? conflictProperty : p)));
          }
          return { conflict: conflictProperty };
        }
      }
      throw err;
    }
  }, []);

  const deleteProperty = useCallback(async (id: string) => {
    await deleteTenantProperty(id);
    if (!isMountedRef.current) return;
    setProperties((prev) => prev.filter((p) => p.id !== id));
    setTotal((prev) => Math.max(0, prev - 1));
  }, []);

  return {
    status,
    properties,
    total,
    page,
    totalPages,
    error,
    filters: { operation, property_type: propertyType, search },
    sort,
    order,
    setOperationFilter,
    setPropertyTypeFilter,
    setSearch,
    setSort,
    nextPage,
    prevPage,
    refresh,
    createProperty,
    updateProperty,
    deleteProperty,
  };
}
