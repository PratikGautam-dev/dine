"use client";

// Adapter: the subset of the ERP's lib/erp.ts that the Customer Management (CRM) screens use, copied from it unchanged, running on Dine's
// staff session (lib/staffAuth). The ERP's own order/product/finance types are not part of this port.
import { useCallback, useEffect, useRef, useState } from "react";
import { staffFetch } from "@/lib/staffAuth";
// ---------------------------------------------------------------------------------------------- channels
export type Channel = "online" | "pos" | "whatsapp";

/** How each sales channel is shown in the UI. The API codes are fixed (and immutable on an order); only the labels
 * are presentational. */
export const CHANNELS: Record<
  Channel,
  { label: string; slug: string; blurb: string }
> = {
  online: {
    label: "Website",
    slug: "online",
    blurb: "Orders placed on the merchant's website.",
  },
  pos: {
    label: "POS",
    slug: "pos",
    blurb: "Counter sales billed at a branch.",
  },
  whatsapp: {
    label: "WhatsApp",
    slug: "whatsapp",
    blurb: "Orders captured in WhatsApp conversations.",
  },
};

export const CHANNEL_ORDER: Channel[] = ["online", "pos", "whatsapp"];

export type Customer = {
  id: string;
  customer_code: string | null;
  name: string;
  phone: string | null;
  email: string | null;
  status: "active" | "blocked";
  notes: string | null;
  gstin?: string | null;
  tags?: string[];
  whatsapp_opt_in?: boolean;
  total_orders?: number;
  total_spent_minor?: number;
  last_order_at?: string | null;
  created_at: string;
};
export type CustomerAddress = {
  id: string;
  label: string | null;
  line1: string;
  line2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  is_default: boolean;
  /** Who the address delivers to, when it differs from the customer. */
  name: string | null;
  phone: string | null;
};
export type Interaction = {
  id: string;
  channel: Channel;
  kind: string;
  summary: string | null;
  occurred_at: string;
};
export type ChannelClient = {
  id: string;
  channel: Channel;
  name: string;
  branch_id: string | null;
  key_prefix: string;
  status: string;
  last_used_at: string | null;
  created_at: string;
};
// ------------------------------------------------------------------------------------------------ helpers
export function formatMoney(minor: number, currency = "INR"): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(minor / 100);
}

/** "1,299.50" typed by a person -> 129950 minor units. Returns null when it isn't a valid non-negative amount. */
export function toMinor(input: string): number | null {
  const cleaned = input.replace(/,/g, "").trim();
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(parseFloat(cleaned) * 100);
}

export function fromMinor(minor: number | null | undefined): string {
  return minor == null ? "" : (minor / 100).toFixed(2);
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString("en-IN", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
}
const ACRONYMS = new Set(["COD", "UPI", "IMEI", "POS", "GST"]);
/** How a payment method is shown: the schema's `wallet` is the customer's store credit, `netbanking` a bank transfer. */
/** "BANK_TRANSFER" -> "Bank Transfer", "UPI" -> "UPI". */
export const humanize = (code: string) =>
  code
    .split("_")
    .map((w) =>
      ACRONYMS.has(w.toUpperCase())
        ? w.toUpperCase()
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join(" ");

/** Display a channel without changing the API value used for filtering and routing. */
export const channelLabel = (channel: string) =>
  CHANNELS[channel as Channel]?.label ?? humanize(channel);

// ------------------------------------------------------------------------------------------------ API calls
export type ApiResult<T> = {
  data: T | null;
  error: string | null;
  unauthorized: boolean;
  status?: number; // the HTTP status of a refused call (none for a network error)
};

/** One JSON call to the ERP API as the signed-in user. */
export async function erp<T = unknown>(
  path: string,
  method: "GET" | "POST" | "PATCH" | "PUT" | "DELETE" = "GET",
  body?: unknown,
  headers?: Record<string, string>,
): Promise<ApiResult<T>> {
  const result = await staffFetch(path, {
    method,
    ...(body !== undefined || headers
      ? {
          headers: {
            ...(body !== undefined
              ? { "Content-Type": "application/json" }
              : {}),
            ...headers,
          },
          ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
        }
      : {}),
  });
  if (!result.ok) {
    return result.unauthorized
      ? {
          data: null,
          error: "Session expired — please sign in again.",
          unauthorized: true,
        }
      : {
          data: null,
          error: result.error,
          unauthorized: false,
        };
  }
  return { data: result.data as T, error: null, unauthorized: false };
}


/** A failed ERP call, for TanStack Query: queries and mutations fail by throwing. `message` is the server's message, ready to show. */
export class ErpError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

function orThrow<T>(res: ApiResult<T>): T {
  if (res.unauthorized) {
    // Hard navigation on purpose: it discards all in-memory state of a session that no longer exists.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.href = "/portal/login";
  }
  if (res.error !== null) throw new ErpError(res.error, res.status);
  return res.data as T;
}

/** A GET for a query's queryFn: the data, or throws an ErpError (and goes to sign-in if the session has ended). */
export async function erpGet<T>(path: string): Promise<T> {
  return orThrow(await erp<T>(path));
}

/** A write for a mutation's mutationFn: the response, or throws an ErpError. */
export async function erpSend<T = unknown>(
  path: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  body?: unknown,
  headers?: Record<string, string>,
): Promise<T> {
  return orThrow(await erp<T>(path, method, body, headers));
}

/** A multipart write (files included) for a mutation's mutationFn: the response, or throws an ErpError. The browser sets the multipart boundary itself. */
export async function erpSendForm<T = unknown>(path: string, form: FormData): Promise<T> {
  const result = await staffFetch(path, { method: "POST", body: form });
  if (!result.ok) {
    return orThrow<T>(
      result.unauthorized
        ? { data: null, error: "Session expired — please sign in again.", unauthorized: true }
        : { data: null, error: result.error, unauthorized: false },
    );
  }
  return result.data as T;
}

/** Load-on-mount (and on reload / path change) GET. Redirects to sign-in if the session has ended.
 * Removed from main in favour of the TanStack Query hooks in src/hooks; kept here only for the CRM screens that still call it. */
export function useErpQuery<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const [tick, setTick] = useState(0);
  const latest = useRef(0);

  useEffect(() => {
    if (path === null) return;
    const id = ++latest.current;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const res = await erp<T>(path);
      if (cancelled || id !== latest.current) return;
      if (res.unauthorized) {
        // Hard navigation on purpose: it discards all in-memory state of a session that no longer exists.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/portal/login";
        return;
      }
      setData(res.data);
      setError(res.error);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [path, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { data, error, loading, reload };
}

export function qs(
  params: Record<string, string | number | boolean | null | undefined>,
): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params))
    if (v !== null && v !== undefined && v !== "" && v !== false)
      sp.set(k, String(v));
  const s = sp.toString();
  return s ? `?${s}` : "";
}


// ---------------------------------------------------------------------------------------------- types copied from the ERP
export type Order = {
  id: string;
  order_number: string;
  branch_id: string;
  fulfilment_branch_id: string | null;
  channel: Channel;
  customer_id: string | null;
  /** In list responses: the customer's name, so a list never needs the customer list to label its rows. */
  customer_name?: string | null;
  /** In list responses: where the next page starts after this row (usePagedQuery). */
  cursor?: string;
  status:
    | "pending"
    | "confirmed"
    | "preparing"
    | "ready"
    | "out_for_delivery"
    | "shipped"
    | "completed"
    | "cancelled"
    | "refunded";
  payment_status:
    | "pending"
    | "authorized"
    | "paid"
    | "failed"
    | "partially_refunded"
    | "refunded";
  order_type: "takeaway" | "pickup" | "delivery" | "shipping";
  currency: string;
  subtotal_minor: number;
  discount_minor: number;
  tax_minor: number;
  total_minor: number;
  paid_minor: number;
  refunded_minor: number;
  placed_at: string;
  cancel_reason: string | null;
  /** A sale to a business customer (a dispatch of a sales order, or a business bill at a till), with its credit due date. */
  sale_type?: "retail" | "wholesale";
  sales_order_id?: string | null;
  due_date?: string | null;
  /** Present on the orders list: who bought it (with customer_name above), from which branch, and how many units. */
  customer_phone?: string | null;
  branch_name?: string | null;
  item_count?: number;
  /** Distinct recorded payment methods in list responses, excluding failed attempts. */
  payment_methods?: string[];
  /** Present on the orders list: the order's open return or exchange (else its latest finished one), and how many it has. */
  return_kind?: "return" | "exchange" | null;
  return_status?: "requested" | "approved" | "completed" | null;
  return_number?: string | null;
  return_count?: number;
};

export type StoreCredit = {
  balance_minor: number;
  entries: {
    id: string;
    delta_minor: number;
    reason: string;
    created_at: string;
  }[];
};

export type DiscountKind =
  "percent" | "flat" | "free_delivery" | "bogo" | "buy_x_get_y" | "fixed_price";

export type Discount = {
  category_ids: string[];
  collection_ids: string[];
  memberships: import("@/lib/erp/crm").Segment[];
  customer_ids: string[];
  contacts: Customer[];
  product_ids: string[];
  products: { id: string; name: string }[];
  customer_tags: string[];
  account_ids: string[];
  segment_ids: string[];
  description: string | null;
  min_quantity: number;
  buy_quantity: number | null;
  get_quantity: number | null;
  combine_with_discounts: boolean;
  combine_with_points: boolean;
  priority: "low" | "normal" | "high";
  apply_on: "subtotal" | "total";
  id: string;
  code: string | null;
  name: string;
  kind: DiscountKind;
  /** percent: 0–100; flat and fixed_price: minor units. */
  value: number;
  max_discount_minor: number | null;
  min_order_minor: number;
  channels: Channel[];
  branch_ids: string[] | null;
  usage_limit: number | null;
  per_customer_limit: number | null;
  starts_at: string | null;
  ends_at: string | null;
  is_active: boolean;
  times_used: number;
};

export type Tone =
  "brand" | "clay" | "success" | "neutral" | "warning" | "violet";

export const ORDER_STATUS_TONE: Record<Order["status"], Tone> = {
  pending: "warning",
  confirmed: "clay",
  preparing: "violet",
  ready: "violet",
  out_for_delivery: "violet",
  shipped: "violet",
  completed: "success",
  cancelled: "neutral",
  refunded: "clay",
};
export const PAYMENT_STATUS_TONE: Record<Order["payment_status"], Tone> = {
  pending: "warning",
  authorized: "violet",
  paid: "success",
  failed: "neutral",
  partially_refunded: "clay",
  refunded: "neutral",
};
