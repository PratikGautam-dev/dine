"use client";

import { useQuery } from "@tanstack/react-query";
import { erpGet } from "@/lib/erp/erp";
import { queryKeys } from "@/lib/erp/queryKeys";

/** What the POS tills uploaded (backend pos/reports.py). Money is paise; dates are YYYY-MM-DD in the restaurant's timezone. */
export type PosRange = { start: string; end: string; branchId: string | null };
export type PosFlag = { code: string; message: string };

export type PosSummary = {
  from: string;
  to: string;
  totals: {
    bills: number;
    gross_paise: number;
    discount_paise: number;
    service_charge_paise: number;
    charges_paise: number;
    tax_paise: number;
    total_paise: number;
    complimentary_value_paise: number;
    complimentary_bills: number;
    flagged_bills: number;
    voided_items: number;
    guests: number;
  };
  tenders: { method: string; bills: number; amount_paise: number }[];
  order_types: { order_type: string; bills: number; total_paise: number }[];
  days: { day: string; bills: number; total_paise: number }[];
  top_items: { name: string; variant_name: string | null; quantity: number; total_paise: number }[];
};

export type PosBillRow = {
  id: string;
  bill_no: string;
  order_type: string;
  status: string;
  table_name: string | null;
  token_no: number | null;
  cashier_name: string;
  settled_at: string;
  total_paise: number;
  complimentary_value_paise: number;
  flags: PosFlag[];
  branch_name: string;
  paid_by: string | null;
};

export type PosShiftRow = {
  id: string;
  cashier_name: string;
  opened_at: string;
  closed_at: string;
  opening_float_paise: number;
  cash_sales_paise: number;
  cash_in_paise: number;
  cash_out_paise: number;
  expected_cash_paise: number;
  counted_cash_paise: number;
  difference_paise: number;
  bills: number;
  flags: PosFlag[];
  terminal_code: string;
  branch_name: string;
};

export type PosDayClose = {
  id: string;
  business_day: string;
  closed_at: string;
  closed_by: string;
  totals: { bills: number; total_paise: number };
  server_totals: { bills: number; total_paise: number };
  flags: PosFlag[];
  terminal_code: string;
  branch_name: string;
};

function qs(r: PosRange, extra: Record<string, string> = {}) {
  const p = new URLSearchParams({ start: r.start, end: r.end, ...extra });
  if (r.branchId) p.set("branch_id", r.branchId);
  return p.toString();
}

const key = (r: PosRange) => ({ start: r.start, end: r.end, branch: r.branchId });

export const usePosSummary = (r: PosRange) =>
  useQuery({
    queryKey: queryKeys.posReports("summary", key(r)),
    queryFn: () => erpGet<PosSummary>(`/api/v1/pos/reports/summary?${qs(r)}`),
  });

export const usePosBills = (r: PosRange, flagged: boolean) =>
  useQuery({
    queryKey: queryKeys.posReports("bills", { ...key(r), flagged }),
    queryFn: () =>
      erpGet<{ bills: PosBillRow[] }>(
        `/api/v1/pos/reports/bills?${qs(r, flagged ? { flagged: "true" } : {})}`,
      ),
  });

export const usePosShifts = (r: PosRange) =>
  useQuery({
    queryKey: queryKeys.posReports("shifts", key(r)),
    queryFn: () => erpGet<{ shifts: PosShiftRow[] }>(`/api/v1/pos/reports/shifts?${qs(r)}`),
  });

export const usePosDayCloses = (r: PosRange) =>
  useQuery({
    queryKey: queryKeys.posReports("day-closes", key(r)),
    queryFn: () => erpGet<{ day_closes: PosDayClose[] }>(`/api/v1/pos/reports/day-closes?${qs(r)}`),
  });
