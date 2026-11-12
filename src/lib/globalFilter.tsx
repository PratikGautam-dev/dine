"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReportChannel } from "@/hooks/useReports";

/** The header's global filter: one period and one sales channel shared by every page that opts in
 * (see FILTER_PAGES in PortalShell), so choosing "Last 7 days" on Reports is still "Last 7 days" on
 * Orders. It is remembered in this browser. A page only uses the values it can actually filter by --
 * `usePagePeriod` / `usePageChannel` fall back to a sensible default when the stored value isn't
 * one of the page's options (e.g. Reports has no "Last month"). */
export type Period =
  | "today"
  | "yesterday"
  | "7d"
  | "30d"
  | "this_month"
  | "last_month"
  | "6m"
  | "1y"
  | "fy"
  | "custom"
  | "all";
export type GlobalChannel = ReportChannel;

/** Display order in the filter panel (two columns, row by row). */
export const PERIOD_ORDER: readonly Period[] = [
  "today",
  "yesterday",
  "7d",
  "30d",
  "this_month",
  "last_month",
  "6m",
  "1y",
  "fy",
  "custom",
  "all",
];
export const PERIOD_LABEL: Record<Period, string> = {
  today: "Today",
  yesterday: "Yesterday",
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  this_month: "This month",
  last_month: "Last month",
  "6m": "Last 6 months",
  "1y": "Last 1 year",
  fy: "This financial year",
  custom: "Custom range",
  all: "All time",
};
export const CHANNEL_LABEL: Record<GlobalChannel, string> = {
  "": "All channels",
  whatsapp: "WhatsApp",
  web: "Website",
  dine_in: "Dine-in",
  takeaway: "Takeaway",
  delivery: "Delivery",
};

/** What each kind of page offers in the header (PortalShell's FILTER_PAGES decides which page gets which). */
export const REPORT_PERIODS: readonly Period[] = PERIOD_ORDER.filter((p) => p !== "all"); // the reports API needs a bounded range
export const REPORT_CHANNELS: readonly GlobalChannel[] = [
  "",
  "web",
  "whatsapp",
  "dine_in",
  "takeaway",
  "delivery",
];
export const ORDER_PERIODS: readonly Period[] = PERIOD_ORDER;
export const ORDER_CHANNELS: readonly GlobalChannel[] = ["", "web", "whatsapp"];
export const RETURN_PERIODS: readonly Period[] = PERIOD_ORDER;
export const FEEDBACK_PERIODS: readonly Period[] = PERIOD_ORDER;
export const DASHBOARD_PERIODS: readonly Period[] = PERIOD_ORDER.filter((p) => p !== "all"); // the dashboard API needs a bounded range

// ---------------------------------------------------------------------------------------------- date ranges
const DAY_MS = 24 * 60 * 60 * 1000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

/** A period as concrete dates. `from` is null for "all time". Both ends are inclusive local-time bounds. */
export type DateRange = { from: Date | null; to: Date };
export type CustomRange = { from: string; to: string }; // yyyy-mm-dd, as the date inputs give them

function parseDay(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function resolveRange(
  period: Period,
  custom: CustomRange,
  now: Date = new Date(),
): DateRange {
  const today = startOfDay(now);
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();
  switch (period) {
    case "today":
      return { from: today, to: endOfDay(today) };
    case "yesterday": {
      const day = new Date(y, m, d - 1);
      return { from: day, to: endOfDay(day) };
    }
    case "7d":
      return { from: new Date(y, m, d - 6), to: endOfDay(today) };
    case "30d":
      return { from: new Date(y, m, d - 29), to: endOfDay(today) };
    case "this_month":
      return { from: new Date(y, m, 1), to: endOfDay(today) };
    case "last_month":
      return { from: new Date(y, m - 1, 1), to: endOfDay(new Date(y, m, 0)) };
    case "6m":
      return { from: new Date(y, m - 6, d + 1), to: endOfDay(today) };
    case "1y":
      return { from: new Date(y - 1, m, d + 1), to: endOfDay(today) };
    case "fy": // Indian financial year: 1 April to 31 March
      return { from: new Date(m >= 3 ? y : y - 1, 3, 1), to: endOfDay(today) };
    case "custom": {
      const from = parseDay(custom.from);
      const to = parseDay(custom.to);
      if (from && to && from <= to) return { from, to: endOfDay(to) };
      return resolveRange("30d", custom, now); // incomplete or backwards dates -- keep the page usable
    }
    case "all":
      return { from: null, to: endOfDay(today) };
  }
}

/** "6 Nov – 12 Nov 2026", "12 Nov 2026", or "All time". */
export function formatRange(range: DateRange): string {
  if (!range.from) return "All time";
  const fmt = (d: Date, withYear: boolean) =>
    d.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      ...(withYear ? { year: "numeric" } : {}),
    });
  const sameYear = range.from.getFullYear() === range.to.getFullYear();
  if (startOfDay(range.from).getTime() === startOfDay(range.to).getTime())
    return fmt(range.to, true);
  return `${fmt(range.from, !sameYear)} – ${fmt(range.to, true)}`;
}

/** yyyy-mm-dd in local time -- what the API's `date_from` / `date_to` expect. */
export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** The API's exact-range query parameters for a range ({} for "all time", which has no start). */
export function rangeParams(range: DateRange): { date_from?: string; date_to?: string } {
  return range.from ? { date_from: isoDay(range.from), date_to: isoDay(range.to) } : {};
}

/** How many days back from now the range starts (what the `days` API parameter means); 0 = all time. */
export function daysBack(range: DateRange): number {
  if (!range.from) return 0;
  return Math.max(1, Math.ceil((Date.now() - range.from.getTime()) / DAY_MS));
}

/** Is this moment inside the range? Used where a list is fetched by `days` and then trimmed to the exact dates. */
export function inRange(when: Date, range: DateRange): boolean {
  return (!range.from || when >= range.from) && when <= range.to;
}

// ------------------------------------------------------------------------------------------------- state
const STORAGE_KEY = "dc_portal_global_filter";
const DEFAULT_PERIOD: Period = "30d";
const NO_CUSTOM: CustomRange = { from: "", to: "" };

type Saved = { period: Period; channel: GlobalChannel; custom: CustomRange };

type Value = Saved & {
  setPeriod: (p: Period) => void;
  setChannel: (c: GlobalChannel) => void;
  /** Pick the "Custom range" period with these dates (yyyy-mm-dd). */
  setCustomRange: (from: string, to: string) => void;
};

const GlobalFilterContext = createContext<Value>({
  period: DEFAULT_PERIOD,
  channel: "",
  custom: NO_CUSTOM,
  setPeriod: () => {},
  setChannel: () => {},
  setCustomRange: () => {},
});

const isPeriod = (v: unknown): v is Period => typeof v === "string" && v in PERIOD_LABEL;
const isChannel = (v: unknown): v is GlobalChannel => typeof v === "string" && v in CHANNEL_LABEL;

/** The saved choice, read when the provider is created (not in an effect) so a page's own mount effect
 * never sees -- or writes back -- the defaults before the saved choice has been loaded. */
function readSaved(): Saved {
  const fallback: Saved = { period: DEFAULT_PERIOD, channel: "", custom: NO_CUSTOM };
  if (typeof window === "undefined") return fallback;
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as Record<string, unknown>;
    const custom = saved.custom as Partial<CustomRange> | undefined;
    return {
      // a period an older version stored may no longer exist
      period: isPeriod(saved.period) ? saved.period : fallback.period,
      channel: isChannel(saved.channel) ? saved.channel : fallback.channel,
      custom: {
        from: typeof custom?.from === "string" ? custom.from : "",
        to: typeof custom?.to === "string" ? custom.to : "",
      },
    };
  } catch {
    return fallback; // unreadable storage -- keep the defaults
  }
}

export function GlobalFilterProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<Saved>(readSaved);

  const update = useCallback((patch: Partial<Saved>) => {
    setState((prev) => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* storage full or blocked -- the choice still applies for this visit */
      }
      return next;
    });
  }, []);

  const value = useMemo<Value>(
    () => ({
      ...state,
      setPeriod: (period) => update({ period }),
      setChannel: (channel) => update({ channel }),
      setCustomRange: (from, to) => update({ period: "custom", custom: { from, to } }),
    }),
    [state, update],
  );
  return <GlobalFilterContext.Provider value={value}>{children}</GlobalFilterContext.Provider>;
}

export function useGlobalFilter(): Value {
  return useContext(GlobalFilterContext);
}

/** The stored period if this page offers it, otherwise the page's default (30 days when offered, else its first option). */
export function resolvePeriod(period: Period, allowed: readonly Period[]): Period {
  if (allowed.includes(period)) return period;
  return allowed.includes(DEFAULT_PERIOD) ? DEFAULT_PERIOD : allowed[0];
}

/** The stored channel if this page offers it, otherwise "All channels". */
export function resolveChannel(
  channel: GlobalChannel,
  allowed: readonly GlobalChannel[],
): GlobalChannel {
  return allowed.includes(channel) ? channel : "";
}

/** The period this page should actually use: its dates, how many days back that reaches (0 = all time), and a label. */
export function usePagePeriod(allowed: readonly Period[]) {
  const { period, custom, setPeriod } = useGlobalFilter();
  const effective = resolvePeriod(period, allowed);
  const range = useMemo(() => resolveRange(effective, custom), [effective, custom]);
  return {
    period: effective,
    range,
    days: daysBack(range),
    label: PERIOD_LABEL[effective],
    setPeriod,
  };
}

/** The channel this page should actually use. */
export function usePageChannel(allowed: readonly GlobalChannel[]) {
  const { channel, setChannel } = useGlobalFilter();
  return { channel: resolveChannel(channel, allowed), setChannel };
}
