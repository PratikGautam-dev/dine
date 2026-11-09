"use client";

import { useEffect, useMemo, useState } from "react";
import { Bike, CalendarClock, MoreHorizontal, Percent, Plus, ShoppingBag, Tag, Ticket, TrendingDown } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { PageHeader } from "@/components/ui/PageHeader";
import { TableSkeleton } from "@/components/ui/Skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatTile } from "@/components/portal/StatTile";
import { WhatsAppIcon } from "@/components/portal/WhatsAppIcon";
import { formatDate } from "@/lib/formatDate";
import { rupees } from "@/lib/foodOrders";
import { getSuperAdminAccessToken } from "@/lib/superAdminAuth";
import { usePlatformOffers, type NewPlatformOfferFields, type PlatformOffer } from "@/hooks/usePlatformOffers";

// Modeled on /portal/offers/page.tsx's information architecture, minus the branch-chip
// restriction UI and per-hospital analytics (trend chart / top-redeemed / customer-segments --
// plan section 2/7's explicit v1 scope cut) that don't generalize to a cross-tenant view.

const STATUS_TONE: Record<string, "success" | "brand" | "neutral" | "clay"> = {
  active: "success",
  scheduled: "brand",
  expired: "neutral",
  disabled: "clay",
};
const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  scheduled: "Scheduled",
  expired: "Expired",
  disabled: "Disabled",
};

const emptyForm = (): NewPlatformOfferFields => ({
  name: "",
  discount_type: "percentage",
  discount_value: 20,
  coupon_code: "",
  valid_from: "",
  valid_to: "",
  min_order_value_paise: 0,
  max_redemptions: null,
  fulfillment_type: "",
  per_customer_limit: null,
});

function ChannelBadge({ offer }: { offer: PlatformOffer }) {
  if (offer.fulfillment_type === "pickup") {
    return (
      <span className="inline-flex items-center gap-1 text-[11.5px] text-ink-600">
        <ShoppingBag size={13} /> Takeaway
      </span>
    );
  }
  if (offer.fulfillment_type === "delivery") {
    return (
      <span className="inline-flex items-center gap-1 text-[11.5px] text-ink-600">
        <Bike size={13} /> Delivery
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-[11.5px] text-ink-600">
      <WhatsAppIcon size={13} /> All orders
    </span>
  );
}

export default function PlatformOffersPage() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // AdminLayout already redirects to /admin/login when unauthenticated; this just gates this
    // page's own data fetch until that check has had a chance to run.
    if (getSuperAdminAccessToken()) setReady(true);
  }, []);

  const { data, error, creating, createPlatformOffer, togglePlatformOffer } = usePlatformOffers(ready);
  const [form, setForm] = useState<NewPlatformOfferFields>(emptyForm());
  const [formError, setFormError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const filteredOffers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const all = data?.offers ?? [];
    if (!q) return all;
    return all.filter((o) => [o.name, o.coupon_code, o.discount_type].some((v) => v.toLowerCase().includes(q)));
  }, [data, search]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!form.name.trim() || !form.coupon_code.trim() || !form.valid_from || !form.valid_to) {
      setFormError("Name, coupon code and validity dates are required.");
      return;
    }
    const ok = await createPlatformOffer(form);
    if (ok) {
      setForm(emptyForm());
      setDialogOpen(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Platform Coupons"
        icon={<Tag size={22} />}
        description="Coupon codes that apply across every restaurant on the storefront."
        actions={
          <Button onClick={() => setDialogOpen(true)}>
            <Plus size={14} /> Create coupon
          </Button>
        }
      />
      {error && <p className="mb-space-4 text-[13px] text-error">{error}</p>}

      {data && (
        <div className="mb-space-4 grid grid-cols-1 gap-space-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatTile icon={<Tag size={22} />} label="Active coupons" value={data.kpis.active_offers} deltaPct={null} hint="Live right now" tone="brand" filled />
          <StatTile icon={<CalendarClock size={22} />} label="Scheduled campaigns" value={data.kpis.scheduled_campaigns} deltaPct={null} hint="Not started yet" tone="info" filled />
          <StatTile icon={<Ticket size={22} />} label="Coupon redemptions" value={data.kpis.coupon_redemptions} deltaPct={null} hint="All time" tone="warning" filled />
          <StatTile
            icon={<TrendingDown size={22} />}
            label="Revenue from coupons"
            value={Math.round(data.kpis.revenue_from_offers_paise / 100)}
            prefix="₹"
            deltaPct={null}
            hint="Orders using a platform coupon"
            tone="clay"
            filled
          />
          <StatTile icon={<CalendarClock size={22} />} label="Expiring soon" value={data.kpis.expiring_soon} deltaPct={null} hint="Within 7 days" tone="violet" filled upIsGood={false} />
        </div>
      )}

      {dialogOpen && (
        <Modal onClose={() => setDialogOpen(false)} labelledBy="platform-offer-form-title" maxWidthClass="max-w-[480px]">
          <h2 id="platform-offer-form-title" className="mb-space-4 text-[16px] font-semibold text-ink-900">
            Create Platform Coupon
          </h2>
          <form onSubmit={handleCreate}>
            <Field label="Coupon Name" htmlFor="po-name" required>
              <Input id="po-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Platform Launch Week" />
            </Field>
            <Field label="Discount Type" htmlFor="po-type" required>
              <select
                id="po-type"
                value={form.discount_type}
                onChange={(e) => setForm({ ...form, discount_type: e.target.value as "percentage" | "flat" })}
                className="h-11 w-full rounded-md border border-line bg-card px-space-3 text-[14px] text-ink-900"
              >
                <option value="percentage">Discount (Percentage)</option>
                <option value="flat">Discount (Flat ₹ amount)</option>
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-space-3">
              <Field label={form.discount_type === "percentage" ? "Discount Value (%)" : "Discount Value (₹)"} htmlFor="po-value" required>
                <Input id="po-value" type="number" min={1} value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: Number(e.target.value) })} />
              </Field>
              <Field label="Coupon Code" htmlFor="po-code" required>
                <Input id="po-code" value={form.coupon_code} placeholder="e.g. PLATFORM20" onChange={(e) => setForm({ ...form, coupon_code: e.target.value.toUpperCase() })} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-space-3">
              <Field label="Valid From" htmlFor="po-from" required>
                <Input id="po-from" type="date" value={form.valid_from} onChange={(e) => setForm({ ...form, valid_from: e.target.value })} />
              </Field>
              <Field label="Valid To" htmlFor="po-to" required>
                <Input id="po-to" type="date" value={form.valid_to} onChange={(e) => setForm({ ...form, valid_to: e.target.value })} />
              </Field>
            </div>
            <Field label="Applies To" htmlFor="po-fulfillment" hint="Leave as All Orders to apply to both.">
              <select
                id="po-fulfillment"
                value={form.fulfillment_type}
                onChange={(e) => setForm({ ...form, fulfillment_type: e.target.value as NewPlatformOfferFields["fulfillment_type"] })}
                className="h-11 w-full rounded-md border border-line bg-card px-space-3 text-[14px] text-ink-900"
              >
                <option value="">All Orders</option>
                <option value="pickup">Takeaway only</option>
                <option value="delivery">Delivery only</option>
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-space-3">
              <Field label="Min. Order Value (₹)" htmlFor="po-min" hint="Optional">
                <Input
                  id="po-min"
                  type="number"
                  min={0}
                  value={form.min_order_value_paise / 100}
                  onChange={(e) => setForm({ ...form, min_order_value_paise: Math.round(Number(e.target.value) * 100) })}
                />
              </Field>
              <Field label="Max Redemptions" htmlFor="po-max" hint="Optional, total across every restaurant">
                <Input
                  id="po-max"
                  type="number"
                  min={1}
                  value={form.max_redemptions ?? ""}
                  onChange={(e) => setForm({ ...form, max_redemptions: e.target.value ? Number(e.target.value) : null })}
                />
              </Field>
            </div>
            <Field label="Uses Per Guest" htmlFor="po-per-customer" hint="Optional, caps each phone number">
              <Input
                id="po-per-customer"
                type="number"
                min={1}
                value={form.per_customer_limit ?? ""}
                onChange={(e) => setForm({ ...form, per_customer_limit: e.target.value ? Number(e.target.value) : null })}
              />
            </Field>
            {formError && <p className="mb-space-3 text-[12.5px] font-medium text-error">{formError}</p>}
            <div className="flex justify-end gap-space-2">
              <Button type="button" variant="secondary" onClick={() => setDialogOpen(false)} disabled={creating}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                <Plus size={15} /> {creating ? "Creating…" : "Create coupon"}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      <div className="mb-space-4 flex flex-wrap items-center justify-between gap-space-3">
        <h3 className="text-[15px] font-bold text-ink-900">Platform Coupons{data ? ` (${data.offers.length})` : ""}</h3>
        <Input placeholder="Search coupons by name or code…" value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-[260px]" />
      </div>

      <Card className="mb-space-4 overflow-x-auto p-space-2">
        {!data ? (
          <TableSkeleton rows={5} columns={5} />
        ) : filteredOffers.length === 0 ? (
          <p className="p-space-4 text-center text-[13px] text-ink-400">
            {search ? "No coupons match that search." : "No platform coupons yet — create one above."}
          </p>
        ) : (
          <table className="w-full text-left text-[13px]">
            <thead>
              <tr className="text-label border-b border-line text-ink-600">
                <th className="px-space-3 py-space-2 font-medium">Name</th>
                <th className="px-space-3 py-space-2 font-medium">Discount</th>
                <th className="px-space-3 py-space-2 font-medium">Fulfillment</th>
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
                    {o.per_customer_limit != null && <p className="text-[11px] text-ink-500">Max {o.per_customer_limit} per guest</p>}
                  </td>
                  <td className="px-space-3 py-space-2 text-ink-700">
                    <span className="inline-flex items-center gap-1">
                      <Percent size={12} /> {o.discount_type === "percentage" ? `${o.discount_value}% OFF` : `${rupees(o.discount_value)} OFF`}
                    </span>
                  </td>
                  <td className="px-space-3 py-space-2">
                    <ChannelBadge offer={o} />
                  </td>
                  <td className="px-space-3 py-space-2 whitespace-nowrap text-ink-600">
                    {formatDate(o.valid_from)} - {formatDate(o.valid_to)}
                  </td>
                  <td className="px-space-3 py-space-2 tabular-nums text-ink-600">
                    {o.usage_count}
                    {o.max_redemptions ? ` / ${o.max_redemptions}` : ""}
                  </td>
                  <td className="px-space-3 py-space-2 font-semibold tabular-nums text-ink-900">{rupees(o.revenue_paise)}</td>
                  <td className="px-space-3 py-space-2">
                    <Badge tone={STATUS_TONE[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                  </td>
                  <td className="px-space-3 py-space-2 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-600 hover:bg-black/4 hover:text-ink-900"
                        aria-label={`Actions for ${o.name}`}
                      >
                        <MoreHorizontal size={16} />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuGroup>
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => togglePlatformOffer(o)}>
                            {o.is_active ? "Disable coupon" : "Enable coupon"}
                          </DropdownMenuItem>
                        </DropdownMenuGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
