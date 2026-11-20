"use client";

import {
  AlertTriangle,
  BarChart3,
  Box,
  CalendarDays,
  CheckCircle2,
  Cloud,
  FileText,
  Home,
  Package,
  Receipt,
  RotateCcw,
  Settings,
  ShoppingCart,
  Store,
  Truck,
  User,
  Users,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/erp-ui/Badge";
import { Button } from "@/components/erp-ui/Button";
import { Field } from "@/components/erp-ui/Field";
import { Select } from "@/components/erp-ui/Select";
import { Switch } from "@/components/erp-ui/Switch";
import {
  type BrandDraft,
  brandProblems,
  PosBrandPanel,
} from "@/components/portal/channels/PosBrandPanel";
import { usePosBranding, useSavePosBranding } from "@/hooks/usePosBranding";
import { tillColors, type PosBranding } from "@/lib/posBranding";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/erp/cn";

/**
 * POS screen editor: what a business can change about its tills (tree on the left, live preview in the middle, settings of
 * the selected item on the right). The till's dashboard is the same for every business, so it is only shown, not edited.
 *
 * Brand (name, colours, logo, DAAP mark) is saved to the backend and shown on every till after its next sync.
 * Lock screen is still SAMPLE ONLY: nothing about it is saved yet.
 */

type Selection = "brand" | "lock";
const SAMPLE_ONLY = (s: Selection) => s !== "brand";

const toDraft = (b: PosBranding): BrandDraft => ({
  app_name: b.app_name,
  primary_color: b.primary_color,
  sidebar_color: b.sidebar_color,
  logo_url: b.logo_url,
});

const DAAP_DRAFT: BrandDraft = {
  app_name: "DAAP POS",
  primary_color: "#2F6FED",
  sidebar_color: null,
  logo_url: null,
};

const NAV = [
  { label: "Dashboard", icon: Home },
  { label: "Billing", icon: ShoppingCart },
  { label: "Products", icon: Box },
  { label: "Customers", icon: Users },
  { label: "Inventory", icon: Package },
  { label: "Purchases", icon: FileText },
  { label: "Suppliers", icon: Truck },
  { label: "Returns", icon: RotateCcw },
  { label: "Reports", icon: BarChart3 },
  { label: "Settings", icon: Settings },
];

const STATS: {
  label: string;
  value: string;
  note: string;
  tone: string;
  icon: typeof Home;
}[] = [
  {
    label: "Today's Sales",
    value: "₹1,771.00",
    note: "+12% vs yesterday",
    tone: "bg-blue-50",
    icon: ShoppingCart,
  },
  {
    label: "Orders",
    value: "12",
    note: "+3 vs yesterday",
    tone: "bg-sky-50",
    icon: FileText,
  },
  {
    label: "Customers",
    value: "9",
    note: "+2 vs yesterday",
    tone: "bg-violet-50",
    icon: Users,
  },
  {
    label: "Inventory Value",
    value: "₹2,48,500.00",
    note: "+5% as on today",
    tone: "bg-orange-50",
    icon: Package,
  },
  {
    label: "Pending Returns",
    value: "2",
    note: "View returns",
    tone: "bg-red-50",
    icon: RotateCcw,
  },
  {
    label: "Low Stock Alerts",
    value: "7",
    note: "View products",
    tone: "bg-red-50",
    icon: AlertTriangle,
  },
];

const BILLS = [
  ["POS-1008", "10:24 AM", "Walk-in Customer", "4", "₹1,771.00", "Cash"],
  ["POS-1007", "09:58 AM", "Rajeev K", "3", "₹850.00", "UPI"],
  ["POS-1006", "09:32 AM", "Walk-in Customer", "2", "₹330.00", "Card"],
  ["POS-1005", "09:15 AM", "Anitha P", "5", "₹1,250.00", "Cash"],
];
const TOP = [
  ["LED Bulb 9W", "28", "₹3,360.00"],
  ["Extension Board 4 Way", "16", "₹5,600.00"],
  ["Ceiling Light 12W", "12", "₹10,200.00"],
  ["Switch 6A", "11", "₹2,970.00"],
];
const PAYMENTS = [
  { label: "Cash", pct: 55, color: "#1d63ed" },
  { label: "Card", pct: 24, color: "#7fb0f5" },
  { label: "UPI", pct: 18, color: "#2bb673" },
  { label: "Split", pct: 2, color: "#c4b5fd" },
];
// conic-gradient stops: each slice starts where the previous one ended.
const DONUT = `conic-gradient(${PAYMENTS.map((p, i) => {
  const from = PAYMENTS.slice(0, i).reduce((n, q) => n + q.pct, 0);
  return `${p.color} ${from}% ${from + p.pct}%`;
}).join(",")})`;
const TREND = [6, 11, 10.5, 16, 23, 17.5, 23.5];

/** A dashboard card in the preview (the till's dashboard is the same for every business: shown, not edited). */
function Widget({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "min-w-0 rounded-lg border border-slate-200 bg-white p-2.5 text-slate-800",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Trend({ accent }: { accent: string }) {
  const pts = TREND.map((v, i) => `${(i / (TREND.length - 1)) * 100},${100 - (v / 30) * 100}`).join(
    " ",
  );
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-24 w-full" aria-hidden>
      <polygon points={`0,100 ${pts} 100,100`} fill={accent} opacity="0.12" />
      <polyline
        points={pts}
        fill="none"
        stroke={accent}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function Preview({
  sel,
  onSelect,
  brand,
}: {
  sel: Selection;
  onSelect: (s: Selection) => void;
  brand: BrandDraft;
}) {
  const {
    primary: accent,
    sidebar,
    accent: sidebarAccent,
  } = tillColors(brand.primary_color, brand.sidebar_color);
  const name = brand.app_name.trim() || "DAAP POS";
  const cut = name.lastIndexOf(" ");
  return (
    <div
      style={{ "--pos-accent": accent } as React.CSSProperties}
      className="@container overflow-hidden rounded-xl border border-slate-300 bg-slate-100 text-[10px] shadow-[var(--shadow-md)]"
    >
      <div className="flex">
        <aside
          className="hidden w-[132px] shrink-0 p-2 text-white @min-[400px]:block"
          style={{ background: sidebar }}
        >
          <div
            role="button"
            tabIndex={0}
            onClick={() => onSelect("brand")}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onSelect("brand")}
            className={cn(
              "mb-2 flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 outline-none",
              sel === "brand" && "ring-2 ring-white/70",
            )}
          >
            {brand.logo_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={brand.logo_url}
                alt=""
                className="size-5 shrink-0 rounded bg-white object-contain"
              />
            )}
            <p className="truncate text-[13px] font-extrabold tracking-wide">
              {cut > 0 ? name.slice(0, cut + 1) : name}
              {cut > 0 && <span style={{ color: sidebarAccent }}>{name.slice(cut + 1)}</span>}
            </p>
          </div>
          {NAV.map((n, i) => (
            <div
              key={n.label}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-1.5 py-1.5",
                i === 0 ? "text-white" : "text-white/75",
              )}
              style={i === 0 ? { background: accent } : undefined}
            >
              <n.icon size={12} /> {n.label}
            </div>
          ))}
        </aside>
        <div className="min-w-0 flex-1 p-2.5">
          <div className="mb-2.5 flex flex-wrap items-center gap-2 rounded-lg bg-white px-2.5 py-1.5">
            <span className="flex items-center gap-1 font-semibold">
              <Store size={12} style={{ color: accent }} /> Main Branch - Kochi
            </span>
            <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
              <Cloud size={11} /> Synced with backend
            </span>
            <span className="ml-auto flex items-center gap-1 font-semibold">
              <User size={12} style={{ color: accent }} /> Rakesh (Cashier)
            </span>
            <span className="flex items-center gap-1 text-slate-600">
              <CalendarDays size={12} /> Tue, 14 Jan 2025 · 10:24 AM
            </span>
          </div>

          <div className="mb-2.5 grid grid-cols-2 gap-2 @min-[480px]:grid-cols-3 @min-[900px]:grid-cols-6">
            {STATS.map((s) => (
              <Widget key={s.label} className={s.tone}>
                <div className="flex items-center gap-1.5">
                  <s.icon size={14} style={{ color: accent }} />
                  <span className="truncate text-slate-600">{s.label}</span>
                </div>
                <p className="mt-1 truncate text-[13px] font-bold">{s.value}</p>
                <p className="truncate text-emerald-700">{s.note}</p>
              </Widget>
            ))}
          </div>

          <div className="mb-2.5 flex flex-col gap-2 @min-[1000px]:flex-row">
            <Widget className="@min-[1000px]:flex-[2]">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[12px] font-bold">Sales Trend</p>
                  <p className="text-slate-500">Daily sales for the last 7 days</p>
                </div>
                <span className="rounded px-1.5 py-0.5 text-white" style={{ background: accent }}>
                  7 Days
                </span>
              </div>
              <Trend accent={accent} />
              <div className="flex justify-between text-slate-500">
                <span>8 Jan</span>
                <span>11 Jan</span>
                <span>14 Jan</span>
              </div>
            </Widget>
            <Widget className="@min-[1000px]:flex-1">
              <p className="flex items-center gap-1 text-[12px] font-bold">
                <CheckCircle2 size={12} style={{ color: accent }} /> Payment Method Breakdown
              </p>
              <div className="mt-2 flex items-center gap-3">
                <div
                  className="grid size-20 shrink-0 place-items-center rounded-full"
                  style={{ background: DONUT }}
                >
                  <div className="grid size-12 place-items-center rounded-full bg-white text-center font-bold">
                    ₹1,771
                  </div>
                </div>
                <ul className="min-w-0 flex-1 space-y-1">
                  {PAYMENTS.map((p) => (
                    <li key={p.label} className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full" style={{ background: p.color }} />{" "}
                      {p.label}
                      <span className="ml-auto text-slate-500">{p.pct}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Widget>
          </div>

          <div className="flex flex-col gap-2 @min-[1000px]:flex-row">
            <Widget className="@container/bills @min-[1000px]:flex-[3]">
              <p className="mb-1 flex items-center gap-1 text-[12px] font-bold">
                <Receipt size={12} style={{ color: accent }} /> Recent Bills
              </p>
              {BILLS.map((b) => (
                <div
                  key={b[0]}
                  className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-2 gap-y-1 border-t border-slate-100 py-1.5 @min-[400px]/bills:grid-cols-[auto_auto_minmax(0,1fr)_auto_auto]"
                >
                  <span className="whitespace-nowrap font-semibold">{b[0]}</span>
                  <span className="col-start-1 row-start-2 whitespace-nowrap text-slate-500 @min-[400px]/bills:col-start-auto @min-[400px]/bills:row-start-auto">
                    {b[1]}
                  </span>
                  <span className="col-span-2 col-start-2 row-start-2 min-w-0 truncate text-right @min-[400px]/bills:col-span-1 @min-[400px]/bills:col-start-auto @min-[400px]/bills:row-start-auto @min-[400px]/bills:text-left">
                    {b[2]}
                  </span>
                  <span className="col-start-2 row-start-1 whitespace-nowrap font-semibold @min-[400px]/bills:col-start-auto @min-[400px]/bills:row-start-auto">
                    {b[4]}
                  </span>
                  <span className="col-start-3 row-start-1 whitespace-nowrap rounded-full bg-slate-100 px-1.5 @min-[400px]/bills:col-start-auto @min-[400px]/bills:row-start-auto">
                    {b[5]}
                  </span>
                </div>
              ))}
            </Widget>
            <Widget className="@min-[1000px]:flex-[3]">
              <p className="mb-1 text-[12px] font-bold">Top Selling Products</p>
              {TOP.map((p, i) => (
                <div key={p[0]} className="flex items-center gap-2 border-t border-slate-100 py-1">
                  <span className="text-slate-500">{i + 1}</span>
                  <span className="truncate">{p[0]}</span>
                  <span className="ml-auto text-slate-500">{p[1]}</span>
                  <span className="font-semibold">{p[2]}</span>
                </div>
              ))}
            </Widget>
            <Widget className="@min-[1000px]:flex-[2]">
              <p className="flex items-center justify-between text-[12px] font-bold">
                <span className="flex items-center gap-1">
                  <Cloud size={12} style={{ color: accent }} /> Sync Insight
                </span>
                <span className="rounded-full bg-emerald-50 px-2 text-emerald-700">Connected</span>
              </p>
              <p className="mt-1 text-slate-600">
                Your website and POS share the same products, stock, customers and orders in real
                time.
              </p>
            </Widget>
          </div>
        </div>
      </div>
    </div>
  );
}

const SECTIONS: { key: Selection; label: string }[] = [
  { key: "brand", label: "Brand" },
  { key: "lock", label: "Lock screen" },
];

/** Brand / Lock screen as one row of pills; the panel below shows the chosen one's settings. */
function SectionPills({ value, onChange }: { value: Selection; onChange: (s: Selection) => void }) {
  return (
    <div
      role="tablist"
      aria-label="POS settings"
      className="mb-space-4 flex gap-1 rounded-full bg-black/[0.05] p-1"
    >
      {SECTIONS.map((x) => (
        <button
          key={x.key}
          role="tab"
          type="button"
          aria-selected={value === x.key}
          onClick={() => onChange(x.key)}
          className={cn(
            "flex-auto whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-semibold transition-colors",
            value === x.key
              ? "bg-card text-ink-900 shadow-[var(--shadow-sm)]"
              : "text-ink-600 hover:text-ink-900",
          )}
        >
          {x.label}
        </button>
      ))}
    </div>
  );
}

export function PosScreenEditor() {
  const [sel, setSel] = useState<Selection>("brand");
  const saved = usePosBranding();
  const save = useSavePosBranding();
  // The edits not saved yet; null means the draft is what is saved (also after Save and Reset).
  const [edits, setEdits] = useState<BrandDraft | null>(null);
  const savedDraft = saved.data ? toDraft(saved.data) : null;
  const brand = edits ?? savedDraft ?? DAAP_DRAFT;
  const dirty = edits !== null && JSON.stringify(edits) !== JSON.stringify(savedDraft);
  const invalid = Object.keys(brandProblems(brand)).length > 0;
  const onSave = () =>
    save.mutate(
      { ...brand, app_name: brand.app_name.trim() },
      {
        onSuccess: () => {
          setEdits(null);
          toast.success("Saved", "Tills update on their next sync.");
        },
        onError: (e) => toast.error("Couldn't save the brand", e.message),
      },
    );
  const [lock, setLock] = useState({ pin: true, timeout: "5" });

  return (
    <>
      <div className="mb-space-3 flex flex-wrap items-center justify-between gap-space-3">
        {SAMPLE_ONLY(sel) ? (
          <Badge tone="warning">Preview only: not saved to the tills yet</Badge>
        ) : (
          <Badge tone="success">Saved to every till on its next sync</Badge>
        )}
        <div className="mobile-page-actions mobile-page-actions-pair flex gap-space-2">
          <Button variant="secondary" disabled={!dirty} onClick={() => setEdits(null)}>
            Reset
          </Button>
          <Button onClick={onSave} disabled={!dirty || invalid || save.isPending}>
            {save.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <div className="grid gap-space-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          <Preview sel={sel} onSelect={setSel} brand={brand} />
        </div>

        <aside className="rounded-lg border border-line bg-card p-space-4 shadow-[var(--shadow-sm)]">
          <SectionPills value={sel} onChange={setSel} />
          {sel === "brand" && (
            <PosBrandPanel
              draft={brand}
              onChange={(p) => setEdits({ ...brand, ...p })}
              poweredBy={saved.data?.show_powered_by ?? true}
            />
          )}
          {sel === "lock" && (
            <>
              <label className="mb-space-4 flex items-center justify-between gap-space-3 text-[13.5px] text-ink-900">
                Require staff PIN
                <Switch checked={lock.pin} onChange={() => setLock({ ...lock, pin: !lock.pin })} />
              </label>
              <Field label="Lock after" htmlFor="lock-timeout">
                <Select
                  id="lock-timeout"
                  value={lock.timeout}
                  onValueChange={(value) => setLock({ ...lock, timeout: value })}
                >
                  <option value="1">1 minute idle</option>
                  <option value="5">5 minutes idle</option>
                  <option value="15">15 minutes idle</option>
                  <option value="0">Never</option>
                </Select>
              </Field>
            </>
          )}
        </aside>
      </div>
    </>
  );
}
