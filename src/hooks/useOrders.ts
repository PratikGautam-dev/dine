import { useCallback, useEffect, useRef, useState } from "react";
import { portalFetch } from "@/lib/portalAuth";
import {
  rangeParams,
  type DateRange,
  type GlobalChannel,
  type GlobalPickup,
} from "@/lib/globalFilter";
import type { OrderView } from "@/lib/foodOrders";
import type { FoodOrder } from "@/hooks/useFoodOrders";

/** One row of the Orders page: an online order (WhatsApp, Website, App, skipQ) or a bill a till settled (POS). Backend sales/orders.py. */
export type OrderRow = {
  kind: "online" | "pos";
  id: string;
  branch_id: string;
  number: string;
  channel: GlobalChannel;
  order_type: GlobalPickup;
  /** an online order's status, or a till bill's: settled | complimentary | due (on credit) */
  status: string;
  customer_name: string | null;
  customer_phone: string | null;
  table_name: string | null;
  payment_method: "online" | "pay_at_restaurant" | null;
  total_paise: number;
  placed_at: string;
  counts_as_sale: boolean;
  items: { name: string; quantity: number }[];
  /** an online order in full, for its actions and detail */
  food_order?: FoodOrder | null;
  /** a till bill's payments in short */
  bill?: { payment_methods: string[] };
};

export type OrdersPage = {
  orders: OrderRow[];
  total: number;
  counts: Record<OrderView, number>;
  limit: number;
  offset: number;
};

export type SalesGroup = { key: string; orders: number; revenue_paise: number };

/** What sold in a period, across every channel (only real sales count). */
export type SalesSummary = {
  orders: number;
  revenue_paise: number;
  average_order_paise: number;
  previous?: { orders: number; revenue_paise: number; average_order_paise: number };
  by_channel: SalesGroup[];
  by_order_type: SalesGroup[];
  by_day: { date: string; orders: number; revenue_paise: number }[];
  by_hour: number[];
  top_items: { name: string; quantity: number; revenue_paise: number }[];
  payment_mix: { method: string; revenue_paise: number }[];
  complimentary: { bills: number; value_paise: number };
};

export type OrderFilters = {
  range: DateRange;
  branchId: string | null;
  channels: readonly GlobalChannel[];
  pickups: readonly GlobalPickup[];
};

function filterQuery(
  f: OrderFilters,
  extra: Record<string, string | number | undefined> = {},
): string {
  const params = new URLSearchParams();
  const entries: Record<string, string | number | undefined> = {
    ...rangeParams(f.range),
    branch_id: f.branchId ?? undefined,
    channel: f.channels.join(",") || undefined,
    order_type: f.pickups.join(",") || undefined,
    ...extra,
  };
  for (const [k, v] of Object.entries(entries))
    if (v !== undefined && v !== "") params.set(k, String(v));
  return params.toString();
}

/** A JSON GET that keeps only the answer to the latest request (an older, slower one never overwrites a newer one). */
function useLatest<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const latest = useRef(path);
  useEffect(() => {
    latest.current = path;
  });

  const load = useCallback(async () => {
    if (path === null) {
      setData(null);
      return;
    }
    const requested = path;
    setLoading(true);
    const result = await portalFetch(requested);
    if (latest.current !== requested) return;
    setLoading(false);
    if (!result.ok) {
      if (!result.unauthorized) setError(result.error);
      return;
    }
    setError(null);
    setData(result.data as T);
  }, [path]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- loads from the server; state is set when the response arrives
    load();
  }, [load]);

  return { data, error, loading, reload: load };
}

/** One page of the Orders page's list, with each view's count, under the header's filters. */
export function useOrders(
  ready: boolean,
  f: OrderFilters,
  view: OrderView,
  search: string,
  offset: number,
  limit = 50,
) {
  const path = ready
    ? `/api/portal/orders?${filterQuery(f, { view, q: search.trim() || undefined, limit, offset })}`
    : null;
  const { data, error, loading, reload } = useLatest<OrdersPage>(path);
  return { page: data, error, loading, reload };
}

/** The sales numbers for a period (needs one: "All time" has no summary). */
export function useSalesSummary(ready: boolean, f: OrderFilters) {
  const path = ready && f.range.from ? `/api/portal/orders/summary?${filterQuery(f)}` : null;
  const { data, reload } = useLatest<SalesSummary>(path);
  return { summary: data, reload };
}

/** Every order matching the filters, a page at a time (the CSV export), up to `cap` rows. */
export async function fetchAllOrders(
  f: OrderFilters,
  view: OrderView,
  search: string,
  cap = 5000,
): Promise<OrderRow[]> {
  const rows: OrderRow[] = [];
  for (let offset = 0; offset < cap; offset += 100) {
    const result = await portalFetch(
      `/api/portal/orders?${filterQuery(f, { view, q: search.trim() || undefined, limit: 100, offset })}`,
    );
    if (!result.ok) break;
    const page = result.data as OrdersPage;
    rows.push(...page.orders);
    if (rows.length >= page.total || page.orders.length === 0) break;
  }
  return rows;
}

export type PosBillLine = {
  name: string;
  variant_name: string | null;
  modifiers: { name: string; price_paise?: number }[];
  note: string | null;
  kot_no: number | null;
  quantity: number;
  unit_price_paise: number;
  addons_paise: number;
  discount_paise: number;
  discount_reason: string | null;
  tax_bps: number;
  taxable_paise: number;
  tax_paise: number;
  total_paise: number;
};

/** One till bill as it was printed (read-only in the portal). */
export type PosBill = {
  id: string;
  bill_no: string;
  branch_name: string;
  terminal_code: string;
  terminal_name: string | null;
  order_type: GlobalPickup;
  status: "settled" | "complimentary" | "due";
  table_name: string | null;
  token_no: number | null;
  guests: number | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_gstin: string | null;
  delivery_address: string | null;
  cashier_name: string;
  captain_name: string | null;
  opened_at: string;
  billed_at: string;
  settled_at: string;
  business_day: string;
  prices_include_tax: boolean;
  subtotal_paise: number;
  discount_paise: number;
  discount_reason: string | null;
  service_charge_paise: number;
  charges_paise: number;
  charges: { kind: "packaging" | "delivery"; taxable_paise: number; tax_paise: number }[];
  tax_paise: number;
  tax_breakup: {
    rate_bps: number;
    taxable_paise: number;
    cgst_paise: number;
    sgst_paise: number;
  }[];
  round_off_paise: number;
  total_paise: number;
  complimentary_value_paise: number;
  complimentary_reason: string | null;
  kots: { kot_no: number; sent_at?: string; cancelled?: boolean }[];
  voids: {
    name: string;
    quantity: number;
    reason: string | null;
    by: string | null;
    approved_by: string | null;
    at: string | null;
  }[];
  flags: { code: string; message: string }[];
  reprints: number;
  lines: PosBillLine[];
  payments: {
    method: string;
    amount_paise: number;
    tendered_paise: number | null;
    reference: string | null;
  }[];
};

export function usePosBill(id: string | null) {
  const { data, error, loading } = useLatest<PosBill>(id ? `/api/portal/pos-bills/${id}` : null);
  return { bill: data, error, loading };
}
