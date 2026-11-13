"use client";

import {
  keepPreviousData,
  useQuery,
  type QueryKey,
} from "@tanstack/react-query";
import { useMemo } from "react";
import { erpGet, qs } from "@/lib/erp/erp";
import { useCursorPager } from "@/lib/erp/useCursorPager";

type Params = Record<string, string | number | boolean | null | undefined>;

/** One page of a cursor-paged list endpoint (orders, products, customers, stock, ledgers ...), with the props for <CursorPager>.
 * Changing `filters` goes back to the first page. The server stamps a `cursor` on every row; the next page starts after the last row's.
 * Asks for one row more than the page size to know whether another page exists. The area hooks (useOrderList ...) wrap this. */
export function usePagedQuery<T>(
  key: (params: Params) => QueryKey,
  path: string,
  filters: Params,
  enabled = true,
) {
  const pager = useCursorPager(JSON.stringify(filters));
  const params: Params = {
    ...filters,
    limit: pager.size + 1,
    cursor: pager.cursor ?? undefined,
  };
  const query = useQuery({
    queryKey: key(params),
    queryFn: () => erpGet<T[]>(`${path}${qs(params)}`),
    enabled,
    placeholderData: keepPreviousData,
  });
  const rows = useMemo(
    () => (query.data ?? []).slice(0, pager.size),
    [query.data, pager.size],
  );
  const last = (rows[rows.length - 1] as { cursor?: string } | undefined)
    ?.cursor; // stamped by the server on every row
  return {
    rows,
    isLoading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error,
    refetch: query.refetch,
    pager: {
      page: pager.page,
      shown: rows.length,
      size: pager.size,
      onSize: pager.setSize,
      hasNext: (query.data?.length ?? 0) > pager.size,
      onPrev: pager.prev,
      onNext: () => last && pager.next(last),
    },
  };
}
