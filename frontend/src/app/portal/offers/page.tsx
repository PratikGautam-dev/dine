"use client";

import { useMemo, useState } from "react";
import {
  Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  Bike, CalendarClock, MoreHorizontal, Percent, Plus, ShoppingBag, Tag, Ticket, TrendingDown,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DepartmentDonut } from "@/components/portal/DepartmentDonut";
import { PermissionGate } from "@/components/portal/PermissionGate";
import { PortalShell } from "@/components/portal/PortalShell";
import { StatTile } from "@/components/portal/StatTile";
import { WhatsAppIcon } from "@/components/portal/WhatsAppIcon";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/formatDate";
import { rupees } from "@/lib/foodOrders";
import { useOffers, type NewOfferFields, type Offer } from "@/hooks/useOffers";

const STATUS_TONE: Record<string, "success" | "brand" | "neutral" | "clay"> = {
  active: "success", scheduled: "brand", expired: "neutral", disabled: "clay",
};
const STATUS_LABEL: Record<string, string> = { active: "Active", scheduled: "Scheduled", expired: "Expired", disabled: "Disabled" };

const emptyForm = (): NewOfferFields => ({
  name: "", discount_type: "percentage", discount_value: 20, coupon_code: "", valid_from: "", valid_to: "",
  min_order_value_paise: 0, max_redemptions: null, fulfillment_type: "",
});

function ChannelBadges({ offer }: { offer: Offer }) {
  if (offer.fulfillment_type === "pickup") {
    return <span className="inline-flex items-center gap-1 text-[11.5px] text-ink-600"><ShoppingBag size={13} /> Takeaway</span>;
  }
  if (offer.fulfillment_type === "delivery") {
    return <span className="inline-flex items-center gap-1 text-[11.5px] text-ink-600"><Bike size={13} /> Delivery</span>;
  }
  return <span className="inline-flex items-center gap-1 text-[11.5px] text-ink-600"><WhatsAppIcon size={13} /> All orders</span>;
}

function RevenueTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; dataKey: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const redemptions = payload.find((p) => p.dataKey === "redemptions")?.value ?? 0;
  const revenue = payload.find((p) => p.dataKey === "revenue_paise")?.value ?? 0;
  return (
    <div className="rounded-md border border-line bg-card px-space-3 py-space-2 text-[12.5px] shadow-[var(--shadow-md)]">
      <p className="font-semibold text-ink-900">{label}</p>
      <p className="text-ink-600">{redemptions} redemption{redemptions === 1 ? "" : "s"}</p>
      <p className="text-success">{rupees(revenue)} revenue</p>
    </div>
  );
}

export default function PortalOffersPage() {
  const { hospital, ready } = usePortalGuard();
  const { data, error, creating, createOffer, toggleOffer } = useOffers(ready);
  const [form, setForm] = useState<NewOfferFields>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filteredOffers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = data?.offers ?? [];
    if (!q) return all;
    return all.filter((o) => [o.name, o.coupon_code, o.discount_type].some((v) => v.toLowerCase().includes(q)));
  }, [data, search]);

  const upcoming = useMemo(() => (data?.offers ?? []).filter((o) => o.status === "scheduled"), [data]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim() || !form.coupon_code.trim() || !form.valid_from || !form.valid_to) {
      setFormError("Name, coupon code and validity dates are required.");
      return;
    }
    const ok = await createOffer(form);
    if (ok) setForm(emptyForm());
  }

  return (
    <PortalShell hospital={hospital} active="offers">
        <PageHeader
          title="Offers & Coupons"
          icon={<Tag size={22} />}
          description="Create and manage coupon codes for WhatsApp food orders."
        />
        {error && <p className="mb-space-4 text-[13px] text-error">{error}</p>}

        {data && (
          <div className="mb-space-4 grid grid-cols-1 gap-space-3 sm:grid-cols-2 lg:grid-cols-5">
            <StatTile icon={<Tag size={22} />} label="Active offers" value={data.kpis.active_offers} deltaPct={null} hint="Live right now" tone="brand" filled />
            <StatTile icon={<CalendarClock size={22} />} label="Scheduled campaigns" value={data.kpis.scheduled_campaigns} deltaPct={null} hint="Not started yet" tone="info" filled />
            <StatTile icon={<Ticket size={22} />} label="Coupon redemptions" value={data.kpis.coupon_redemptions} deltaPct={null} hint="All time" tone="warning" filled />
            <StatTile
              icon={<TrendingDown size={22} />} label="Revenue from offers" value={Math.round(data.kpis.revenue_from_offers_paise / 100)}
              prefix="₹" deltaPct={null} hint="Orders using a coupon" tone="clay" filled
            />
            <StatTile icon={<CalendarClock size={22} />} label="Expiring soon" value={data.kpis.expiring_soon} deltaPct={null} hint="Within 7 days" tone="violet" filled upIsGood={false} />
          </div>
        )}

        <div className="mb-space-4 grid grid-cols-1 gap-space-4 xl:grid-cols-[1fr_1fr_360px]">
          <Card className="p-space-4">
            <h3 className="mb-space-3 text-[15px] font-bold text-ink-900">Offer Usage Trend</h3>
            {!data || data.trend.every((t) => t.redemptions === 0) ? (
              <div className="flex h-[220px] items-center justify-center text-[13px] text-ink-400">No redemptions in the last 7 days.</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={data.trend} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                  <CartesianGrid stroke="#ebe0d6" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "#ebe0d6" }} tick={{ fontSize: 11, fill: "#6b5f56" }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#6b5f56" }} allowDecimals={false} />
                  <Tooltip content={<RevenueTooltip />} cursor={{ fill: "rgba(226,18,32,0.06)" }} />
                  <Bar dataKey="redemptions" fill="#e21220" radius={[3, 3, 0, 0]} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card className="p-space-4">
            <h3 className="mb-space-3 text-[15px] font-bold text-ink-900">Revenue from Offers</h3>
            {!data || data.trend.every((t) => t.revenue_paise === 0) ? (
              <div className="flex h-[220px] items-center justify-center text-[13px] text-ink-400">No revenue from coupons yet.</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <ComposedChart data={data.trend} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
                  <defs>
                    <linearGradient id="offersRevenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="#22c55e" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#ebe0d6" vertical={false} />
                  <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "#ebe0d6" }} tick={{ fontSize: 11, fill: "#6b5f56" }} />
                  <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "#6b5f56" }} tickFormatter={(v: number) => rupees(v)} />
                  <Tooltip content={<RevenueTooltip />} cursor={{ stroke: "#c9b8a8", strokeDasharray: 3 }} />
                  <Line type="monotone" dataKey="revenue_paise" stroke="#22c55e" strokeWidth={2} dot={{ r: 3, fill: "#22c55e", strokeWidth: 2, stroke: "#fff" }} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card className="p-space-4">
            <h3 className="mb-space-4 text-[15px] font-bold text-ink-900">Create New Offer</h3>
            <PermissionGate page="offers" action="write">
              <form onSubmit={handleCreate}>
                <Field label="Offer Name" htmlFor="offer-name" required>
                  <Input id="offer-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Weekend Special" />
                </Field>
                <Field label="Offer Type" htmlFor="offer-type" required>
                  <select
                    id="offer-type" value={form.discount_type}
                    onChange={(e) => setForm({ ...form, discount_type: e.target.value as "percentage" | "flat" })}
                    className="h-11 w-full rounded-md border border-line bg-card px-space-3 text-[14px] text-ink-900"
                  >
                    <option value="percentage">Discount (Percentage)</option>
                    <option value="flat">Discount (Flat ₹ amount)</option>
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-space-3">
                  <Field label={form.discount_type === "percentage" ? "Discount Value (%)" : "Discount Value (₹)"} htmlFor="offer-value" required>
                    <Input
                      id="offer-value" type="number" min={1} value={form.discount_value}
                      onChange={(e) => setForm({ ...form, discount_value: Number(e.target.value) })}
                    />
                  </Field>
                  <Field label="Coupon Code" htmlFor="offer-code" required>
                    <Input
                      id="offer-code" value={form.coupon_code} placeholder="e.g. FOOD20"
                      onChange={(e) => setForm({ ...form, coupon_code: e.target.value.toUpperCase() })}
                    />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-space-3">
                  <Field label="Valid From" htmlFor="offer-from" required>
                    <Input id="offer-from" type="date" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} />
                  </Field>
                  <Field label="Valid To" htmlFor="offer-to" required>
                    <Input id="offer-to" type="date" value={form.valid_to} onChange={(e) => setForm({ ...form, valid_to: e.target.value })} />
                  </Field>
                </div>
                <Field label="Applies To" htmlFor="offer-fulfillment" hint="Leave as All Orders to apply to both.">
                  <select
                    id="offer-fulfillment" value={form.fulfillment_type}
                    onChange={(e) => setForm({ ...form, fulfillment_type: e.target.value as NewOfferFields["fulfillment_type"] })}
                    className="h-11 w-full rounded-md border border-line bg-card px-space-3 text-[14px] text-ink-900"
                  >
                    <option value="">All Orders</option>
                    <option value="pickup">Takeaway only</option>
                    <option value="delivery">Delivery only</option>
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-space-3">
                  <Field label="Min. Order Value (₹)" htmlFor="offer-min" hint="Optional">
                    <Input
                      id="offer-min" type="number" min={0} value={form.min_order_value_paise / 100}
                      onChange={(e) => setForm({ ...form, min_order_value_paise: Math.round(Number(e.target.value) * 100) })}
                    />
                  </Field>
                  <Field label="Max Redemptions" htmlFor="offer-max" hint="Optional">
                    <Input
                      id="offer-max" type="number" min={1} value={form.max_redemptions ?? ""}
                      onChange={(e) => setForm({ ...form, max_redemptions: e.target.value ? Number(e.target.value) : null })}
                    />
                  </Field>
                </div>
                {formError && <p className="mb-space-3 text-[12.5px] font-medium text-error">{formError}</p>}
                <Button type="submit" disabled={creating} className="w-full">
                  <Plus size={15} /> {creating ? "Creating…" : "Create Offer"}
                </Button>
              </form>
            </PermissionGate>
          </Card>
        </div>

        <div className="mb-space-4 flex flex-wrap items-center justify-between gap-space-3">
          <h3 className="text-[15px] font-bold text-ink-900">Active Offers{data ? ` (${data.offers.length})` : ""}</h3>
          <Input placeholder="Search offers by name or code…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-[260px]" />
        </div>

        <Card className="mb-space-4 overflow-x-auto p-space-2">
          {!data ? (
            <p className="p-space-4 text-[13px] text-ink-400">Loading…</p>
          ) : filteredOffers.length === 0 ? (
            <p className="p-space-4 text-center text-[13px] text-ink-400">{search ? "No offers match that search." : "No offers yet — create one above."}</p>
          ) : (
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="text-label border-b border-line text-ink-600">
                  <th className="px-space-3 py-space-2 font-medium">Offer Name</th>
                  <th className="px-space-3 py-space-2 font-medium">Type</th>
                  <th className="px-space-3 py-space-2 font-medium">Channel</th>
                  <th className="px-space-3 py-space-2 font-medium">Validity</th>
                  <th className="px-space-3 py-space-2 font-medium">Usage</th>
                  <th className="px-space-3 py-space-2 font-medium">Revenue</th>
                  <th className="px-space-3 py-space-2 font-medium">Status</th>
                  <th className="px-space-3 py-space-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {filteredOffers.map((o) => (
                  <tr key={o.id} className="border-b border-line last:border-0">
                    <td className="px-space-3 py-space-2">
                      <p className="font-semibold text-ink-900">{o.name}</p>
                      <p className="font-mono text-[11px] text-ink-400">{o.coupon_code}</p>
                    </td>
                    <td className="px-space-3 py-space-2 text-ink-700">
                      <span className="inline-flex items-center gap-1"><Percent size={12} /> {o.discount_type === "percentage" ? `${o.discount_value}% OFF` : `${rupees(o.discount_value)} OFF`}</span>
                    </td>
                    <td className="px-space-3 py-space-2"><ChannelBadges offer={o} /></td>
                    <td className="px-space-3 py-space-2 whitespace-nowrap text-ink-600">{formatDate(o.valid_from)} - {formatDate(o.valid_to)}</td>
                    <td className="px-space-3 py-space-2 tabular-nums text-ink-600">{o.usage_count}{o.max_redemptions ? ` / ${o.max_redemptions}` : ""}</td>
                    <td className="px-space-3 py-space-2 font-semibold tabular-nums text-ink-900">{rupees(o.revenue_paise)}</td>
                    <td className="px-space-3 py-space-2"><Badge tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge></td>
                    <td className="px-space-3 py-space-2 text-right">
                      <PermissionGate page="offers" action="write">
                        <DropdownMenu>
                          <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-600 hover:bg-black/4 hover:text-ink-900" aria-label={`Actions for ${o.name}`}>
                            <MoreHorizontal size={16} />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuGroup>
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuItem onClick={() => toggleOffer(o)}>
                                {o.is_active ? "Disable offer" : "Enable offer"}
                              </DropdownMenuItem>
                            </DropdownMenuGroup>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </PermissionGate>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        {data && (
          <div className="grid grid-cols-1 gap-space-4 lg:grid-cols-3">
            <Card className="p-space-4">
              <h3 className="mb-space-3 text-[15px] font-bold text-ink-900">Top Redeemed Offers</h3>
              {data.top_redeemed.filter((o) => o.usage_count > 0).length === 0 ? (
                <div className="flex h-[160px] items-center justify-center text-[13px] text-ink-400">No redemptions yet.</div>
              ) : (
                <ol className="divide-y divide-line">
                  {data.top_redeemed.filter((o) => o.usage_count > 0).map((o, i) => (
                    <li key={o.name} className="flex items-center gap-space-3 py-space-2">
                      <span className="w-5 text-[12px] font-semibold text-ink-400">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-ink-900">{o.name}</span>
                      <span className="text-right text-[12.5px] tabular-nums text-ink-600">{o.usage_count} use{o.usage_count === 1 ? "" : "s"}</span>
                      <span className="w-20 text-right text-[13px] font-semibold tabular-nums text-ink-900">{rupees(o.revenue_paise)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </Card>

            <DepartmentDonut
              data={data.customer_segments}
              title="Customer Segments Reached"
              subtitle="Guests who've used a coupon"
              unit="customers"
              emptyText="No coupon redemptions yet."
            />

            <Card className="p-space-4">
              <h3 className="mb-space-3 text-[15px] font-bold text-ink-900">Upcoming Campaigns</h3>
              {upcoming.length === 0 ? (
                <div className="flex h-[160px] items-center justify-center text-[13px] text-ink-400">Nothing scheduled.</div>
              ) : (
                <ul className="divide-y divide-line">
                  {upcoming.map((o) => (
                    <li key={o.id} className="flex items-center justify-between gap-space-2 py-space-2">
                      <div className="min-w-0">
                        <p className="truncate text-[13.5px] font-semibold text-ink-900">{o.name}</p>
                        <p className="text-[11.5px] text-ink-600">Starts {formatDate(o.valid_from)}</p>
                      </div>
                      <Badge tone="brand">Scheduled</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        )}
    </PortalShell>
  );
}
