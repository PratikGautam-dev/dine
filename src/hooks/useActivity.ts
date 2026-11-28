"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { erpGet, qs } from "@/lib/erp/erp";
import type { AuditEntry } from "@/lib/audit";
import { queryKeys } from "@/lib/erp/queryKeys";
import { useCursorPager } from "@/lib/erp/useCursorPager";

export type ActivityFilters = {
  q?: string;
  action?: string;
  entity_type?: string;
  date_from?: string;
  date_to?: string;
};

/** The business's activity log, newest first, filtered on the server and paged by the id of the last entry seen. Asks for one entry more
 * than a page to know whether a next page exists. */
export function useActivityLog(filters: ActivityFilters) {
  const pager = useCursorPager(JSON.stringify(filters));
  const params = {
    ...filters,
    cursor: pager.cursor,
    limit: pager.size + 1,
  };
  const query = useQuery({
    queryKey: queryKeys.activityList(params),
    queryFn: () => erpGet<AuditEntry[]>(`/api/v1/audit-logs${qs(params)}`),
    placeholderData: keepPreviousData,
  });
  const rows = useMemo(() => (query.data ?? []).slice(0, pager.size), [query.data, pager.size]);
  return {
    rows,
    data: query.data,
    error: query.error,
    pager: {
      page: pager.page,
      shown: rows.length,
      size: pager.size,
      onSize: pager.setSize,
      hasNext: (query.data?.length ?? 0) > pager.size,
      onPrev: pager.prev,
      onNext: () => rows.length && pager.next(String(rows[rows.length - 1]!.id)),
    },
  };
}

/** Up to 500 entries matching the filters (not just the page on screen), for the CSV export. */
export function fetchActivityForExport(filters: ActivityFilters) {
  return erpGet<AuditEntry[]>(`/api/v1/audit-logs${qs({ ...filters, limit: 500 })}`);
}
