"use client";

import {
  DeliveryTruck01Icon,
  GiftIcon,
  MoneyBag02Icon,
  PackageIcon,
  PercentCircleIcon,
  RefreshIcon,
  Tag01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useEffect, useState } from "react";
import { CustomerSelect } from "@/components/erp/CustomerSelect";
import { Button } from "@/components/erp-ui/Button";
import { DateTimeField } from "@/components/erp-ui/DateTimeField";
import { Field } from "@/components/erp-ui/Field";
import {
  CheckList,
  ChipList,
  OptionCard,
  Section,
  generateCode,
} from "@/components/erp-ui/FormSection";
import { Input } from "@/components/erp-ui/Input";
import { Modal } from "@/components/erp-ui/Modal";
import { SearchCombobox } from "@/components/erp-ui/SearchCombobox";
import { Select } from "@/components/erp-ui/Select";
import { Switch } from "@/components/erp-ui/Switch";
import { useBranches } from "@/hooks/erp/useBranches";
import { useErpQuery } from "@/lib/erp/erp";
import type { Customer } from "@/lib/erp/erp";
import { SEGMENT_META, SEGMENT_ORDER, type Segment } from "@/lib/erp/crm";
import { portalFetch } from "@/lib/portalAuth";
import { toast } from "@/lib/toast";
import type { NewOfferFields, Offer } from "@/hooks/useOffers";

/* This is the ERP's "New Discount / Offer" form (ERP/shopconnect-tenant/src/app/portal/discounts/page.tsx), same layout and wording.
 * What Dine's offer engine can store is sent (name, code, percent/flat value, min order, validity, usage limits, branches, active);
 * choices it cannot apply at WhatsApp checkout yet are refused on save instead of being silently dropped. */

type DiscountKind = "percent" | "flat" | "free_delivery" | "bogo" | "buy_x_get_y" | "fixed_price";

const KIND_LABEL: Record<DiscountKind, string> = {
  percent: "Percentage off",
  flat: "Flat amount off",
  free_delivery: "Free delivery",
  bogo: "Buy one get one",
  buy_x_get_y: "Buy X get Y",
  fixed_price: "Fixed price",
};

const KIND_META: Record<DiscountKind, { icon: typeof Tag01Icon; hint: string }> = {
  percent: { icon: PercentCircleIcon, hint: "e.g. 10% off" },
  flat: { icon: MoneyBag02Icon, hint: "e.g. ₹200 off" },
  free_delivery: { icon: DeliveryTruck01Icon, hint: "Free shipping" },
  bogo: { icon: GiftIcon, hint: "Buy 1 Get 1" },
  buy_x_get_y: { icon: PackageIcon, hint: "e.g. Buy 3 Get 1" },
  fixed_price: { icon: Tag01Icon, hint: "Special price" },
};

type Channel = "pos" | "online" | "whatsapp";
const CHANNEL_LABEL: Record<Channel, string> = {
  pos: "POS",
  online: "Website",
  whatsapp: "WhatsApp",
};
const SCOPE_LABEL = {
  "": "All orders",
  pickup: "Takeaway",
  dine_in: "Dine in",
  delivery: "Delivery only",
} as const;

type Scope =
  "category" | "collection" | "product" | "membership" | "tag" | "individual" | "segment";

const SCOPES: { key: Scope; group: "product" | "customer"; title: string; hint: string }[] = [
  { key: "category", group: "product", title: "Specific categories", hint: "Select categories" },
  {
    key: "collection",
    group: "product",
    title: "Specific collections",
    hint: "Select collections",
  },
  { key: "product", group: "product", title: "Specific food items", hint: "Select food items" },
  { key: "membership", group: "customer", title: "Membership", hint: "Select tiers" },
  { key: "tag", group: "customer", title: "Customer tags", hint: "Select customer tags" },
  { key: "individual", group: "customer", title: "Individual customers", hint: "Select customers" },
  {
    key: "segment",
    group: "customer",
    title: "Customer segments",
    hint: "Select customer segments",
  },
];

const NO_SCOPES: Record<Scope, boolean> = {
  category: false,
  collection: false,
  product: false,
  membership: false,
  tag: false,
  individual: false,
  segment: false,
};

type Form = {
  scopes: Record<Scope, boolean>;
  categoryIds: string[];
  collectionIds: string[];
  products: { id: string; name: string }[];
  memberships: Segment[];
  tags: string[];
  customers: Customer[];
  segmentIds: string[];
  branchIds: string[];
  code: string;
  name: string;
  description: string;
  channels: Channel[];
  kind: DiscountKind;
  value: string;
  buyQty: string;
  getQty: string;
  maxDiscount: string;
  minOrder: string;
  usageLimit: string;
  perCustomerLimit: string;
  minQuantity: string;
  combineDiscounts: boolean;
  combinePoints: boolean;
  priority: "low" | "normal" | "high";
  applyOn: "subtotal" | "total";
  startsAt: string;
  endsAt: string;
  isActive: boolean;
};

const EMPTY: Form = {
  scopes: NO_SCOPES,
  categoryIds: [],
  collectionIds: [],
  products: [],
  memberships: [],
  tags: [],
  customers: [],
  segmentIds: [],
  branchIds: [],
  code: "",
  name: "",
  description: "",
  channels: ["pos", "online", "whatsapp"],
  kind: "percent",
  value: "",
  buyQty: "",
  getQty: "",
  maxDiscount: "",
  minOrder: "",
  usageLimit: "",
  perCustomerLimit: "",
  minQuantity: "",
  combineDiscounts: false,
  combinePoints: false,
  priority: "normal",
  applyOn: "subtotal",
  startsAt: "",
  endsAt: "",
  isActive: true,
};

function toForm(o: Offer): Form {
  return {
    ...EMPTY,
    name: o.name,
    code: o.coupon_code,
    kind: o.discount_type === "flat" ? "flat" : "percent",
    value: String(o.discount_type === "flat" ? o.discount_value / 100 : o.discount_value),
    minOrder: o.min_order_value_paise ? String(o.min_order_value_paise / 100) : "",
    usageLimit: o.max_redemptions === null ? "" : String(o.max_redemptions),
    perCustomerLimit: o.per_customer_limit === null ? "" : String(o.per_customer_limit),
    branchIds: o.branch_ids,
    startsAt: `${o.valid_from.slice(0, 10)}T00:00`,
    endsAt: `${o.valid_to.slice(0, 10)}T23:59`,
    isActive: o.is_active,
  };
}

const intOrNull = (v: string) => (v.trim() ? Number.parseInt(v, 10) : null);

type MenuLite = { id: string; name: string; category: string | null };

export function OfferFormModal({
  open,
  busy,
  editing = null,
  onClose,
  onSubmit,
}: {
  open: boolean;
  /** The offer being changed; null = a new one. */
  editing?: Offer | null;
  busy: boolean;
  onClose: () => void;
  /** Creates the offer; `active` false saves it paused. Resolves true when saved (the modal then closes). */
  onSubmit: (fields: NewOfferFields, active: boolean) => Promise<boolean>;
}) {
  const [fulfillment, setFulfillment] = useState<NewOfferFields["fulfillment_type"]>(
    editing?.fulfillment_type ?? "",
  );
  const [form, setForm] = useState<Form>(() => (editing ? toForm(editing) : EMPTY));
  const [branchMode, setBranchMode] = useState<"all" | "selected">(
    editing?.branch_ids.length ? "selected" : "all",
  );
  const [menu, setMenu] = useState<MenuLite[]>([]);
  const [menuLoaded, setMenuLoaded] = useState(false);
  const [productQ, setProductQ] = useState("");
  const branches = useBranches();

  const needsMenu = open && (form.scopes.category || form.scopes.product);
  useEffect(() => {
    if (!needsMenu || menuLoaded) return;
    portalFetch("/api/portal/menu-items").then((r) => {
      setMenuLoaded(true);
      if (r.ok)
        setMenu(
          (r.data as { menu_items: MenuLite[] }).menu_items.map((m) => ({
            id: String(m.id),
            name: m.name,
            category: m.category,
          })),
        );
    });
  }, [needsMenu, menuLoaded]);
  const menuLoading = needsMenu && !menuLoaded;

  const tagList = useErpQuery<{ tag: string; customers: number }[]>(
    open && form.scopes.tag ? "/api/v1/crm/tags" : null,
  );
  const segments = useErpQuery<
    { id: string; name: string; status: string; member_count: number }[]
  >(open && form.scopes.segment ? "/api/v1/crm/customer-segments" : null);

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));
  const needsValue = form.kind === "percent" || form.kind === "flat" || form.kind === "fixed_price";

  const selectScope = (group: "product" | "customer", key: Scope | null) =>
    setForm((f) => ({
      ...f,
      scopes: {
        ...f.scopes,
        ...Object.fromEntries(
          SCOPES.filter((s) => s.group === group).map((s) => [s.key, s.key === key]),
        ),
      },
    }));
  const groupHasScope = (group: "product" | "customer") =>
    SCOPES.some((s) => s.group === group && form.scopes[s.key]);

  const categoryNames = Array.from(
    new Set(menu.map((m) => m.category).filter((c): c is string => !!c)),
  );

  const scopeControl = (key: Scope, hint: string) => {
    if (!form.scopes[key])
      return (
        <div className="rounded-md border border-line bg-card px-space-3 py-space-2 text-center text-[13px] text-ink-600">
          {hint}
        </div>
      );
    switch (key) {
      case "category":
        return (
          <CheckList
            items={categoryNames.map((c) => ({ id: c, label: c }))}
            selected={form.categoryIds}
            onChange={(ids) => set("categoryIds", ids)}
            loading={menuLoading}
            empty="No categories yet."
            placeholder={hint}
          />
        );
      case "collection":
        return (
          <CheckList
            items={[]}
            selected={form.collectionIds}
            onChange={(ids) => set("collectionIds", ids)}
            empty="No collections yet."
            placeholder={hint}
          />
        );
      case "membership":
        return (
          <CheckList
            items={SEGMENT_ORDER.filter((k) => k !== "not_member").map((k) => ({
              id: k,
              label: SEGMENT_META[k].label,
            }))}
            selected={form.memberships}
            onChange={(ids) => set("memberships", ids as Segment[])}
            empty="No memberships."
            placeholder={hint}
          />
        );
      case "tag":
        return (
          <CheckList
            items={(tagList.data ?? []).map((t) => ({ id: t.tag, label: t.tag }))}
            selected={form.tags}
            onChange={(ids) => set("tags", ids)}
            loading={tagList.loading}
            empty="No customer tags yet."
            placeholder={hint}
          />
        );
      case "segment":
        return (
          <CheckList
            items={(segments.data ?? [])
              .filter((s) => s.status === "active" || form.segmentIds.includes(s.id))
              .map((s) => ({ id: s.id, label: s.name }))}
            selected={form.segmentIds}
            onChange={(ids) => set("segmentIds", ids)}
            loading={segments.loading}
            empty="No customer segments yet."
            placeholder={hint}
          />
        );
      case "product": {
        const q = productQ.trim().toLowerCase();
        const shown = menu
          .filter(
            (m) =>
              !form.products.some((p) => p.id === m.id) && (!q || m.name.toLowerCase().includes(q)),
          )
          .slice(0, 8);
        return (
          <div className="space-y-space-2">
            <SearchCombobox
              label="Search food items"
              placeholder="Search food items by name…"
              query={productQ}
              onQueryChange={setProductQ}
              items={shown}
              itemLabel={(m) => m.name}
              onPick={(m) => set("products", [...form.products, { id: m.id, name: m.name }])}
              loading={menuLoading}
              emptyLabel="No food items match."
              renderItem={(m) => <span>{m.name}</span>}
            />
            <ChipList
              items={form.products.map((p) => ({ id: p.id, label: p.name }))}
              onRemove={(id) =>
                set(
                  "products",
                  form.products.filter((p) => p.id !== id),
                )
              }
            />
          </div>
        );
      }
      case "individual":
        return (
          <div className="space-y-space-2">
            <CustomerSelect
              id="d_contact"
              value={null}
              onChange={(customer) =>
                customer &&
                !form.customers.some((c) => c.id === customer.id) &&
                set("customers", [...form.customers, customer])
              }
            />
            <ChipList
              items={form.customers.map((c) => ({
                id: c.id,
                label: c.phone ? `${c.name} · ${c.phone}` : c.name,
              }))}
              onRemove={(id) =>
                set(
                  "customers",
                  form.customers.filter((c) => c.id !== id),
                )
              }
            />
          </div>
        );
    }
  };

  const eligibility = (group: "product" | "customer") =>
    SCOPES.filter((s) => s.group === group).map((scope) => (
      <OptionCard
        key={scope.key}
        selected={form.scopes[scope.key]}
        onSelect={() => selectScope(group, scope.key)}
        title={scope.title}
        hint={scope.hint}
      >
        {scopeControl(scope.key, scope.hint)}
      </OptionCard>
    ));

  const shortDate = (v: string) =>
    new Date(v).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  const allChannels = (["pos", "online", "whatsapp"] as Channel[]).every((c) =>
    form.channels.includes(c),
  );
  const toggleChannel = (c: Channel, on: boolean) =>
    set("channels", on ? [...form.channels, c] : form.channels.filter((x) => x !== c));

  const summaryLine = [
    form.kind === "percent"
      ? `${form.value || 0}% off${form.maxDiscount.trim() ? ` (max ₹${form.maxDiscount})` : ""}`
      : form.kind === "flat"
        ? `₹${form.value || 0} off`
        : form.kind === "fixed_price"
          ? `₹${form.value || 0} each`
          : form.kind === "buy_x_get_y"
            ? `Buy ${form.buyQty || "X"} get ${form.getQty || "Y"} free`
            : KIND_LABEL[form.kind],
    groupHasScope("product") ? "on selected food items" : "on all food items",
    form.minOrder.trim() ? `Min order ₹${form.minOrder}` : null,
    form.perCustomerLimit.trim() ? `${form.perCustomerLimit} use per customer` : null,
    form.startsAt || form.endsAt
      ? `Valid ${form.startsAt ? `from ${shortDate(form.startsAt)}` : "now"} ${form.endsAt ? `to ${shortDate(form.endsAt)}` : "with no end"}`
      : null,
    `Available on ${form.channels.map((c) => CHANNEL_LABEL[c]).join(" and ") || "no channel"} (${SCOPE_LABEL[fulfillment]}) - ${form.isActive ? "Active" : "Paused"}`,
  ]
    .filter(Boolean)
    .join(" • ");

  async function save(asDraft = false) {
    if (form.kind !== "percent" && form.kind !== "flat")
      return toast.error(
        `${KIND_LABEL[form.kind]} isn't available yet`,
        "Food-order coupons support percentage off and flat amount off for now.",
      );
    if (groupHasScope("product") || groupHasScope("customer"))
      return toast.error(
        "Eligibility rules aren't available yet",
        "Coupons apply to all food items and all customers for now. Choose “All food items” and “All customers”.",
      );
    const value = Number(form.value);
    if (form.kind === "percent" ? !(value > 0 && value <= 100) : !(value > 0))
      return toast.error(
        "Check the value",
        form.kind === "percent"
          ? "A percentage must be between 0 and 100."
          : "Enter an amount above zero.",
      );
    const minOrder = form.minOrder.trim() ? Number(form.minOrder) : 0;
    if (!Number.isFinite(minOrder) || minOrder < 0)
      return toast.error("Check the minimum order", "Enter a valid amount.");
    if (!form.code.trim())
      return toast.error("Add a code", "Enter a coupon code or press Generate.");
    if (!form.channels.length) return toast.error("Pick a channel", "Choose at least one channel.");
    if (branchMode === "selected" && !form.branchIds.length)
      return toast.error("Pick a branch", "Choose at least one branch.");
    const today = new Date().toISOString().slice(0, 10);
    const nextYear = new Date(Date.now() + 365 * 86_400_000).toISOString().slice(0, 10);
    const ok = await onSubmit(
      {
        name: form.name.trim(),
        discount_type: form.kind === "percent" ? "percentage" : "flat",
        // a flat amount is stored in paise, a percentage as the percentage itself
        discount_value: form.kind === "flat" ? Math.round(value * 100) : Math.round(value),
        coupon_code: form.code.trim().toUpperCase(),
        valid_from: form.startsAt ? form.startsAt.slice(0, 10) : today,
        valid_to: form.endsAt ? form.endsAt.slice(0, 10) : nextYear,
        min_order_value_paise: Math.round(minOrder * 100),
        max_redemptions: intOrNull(form.usageLimit),
        fulfillment_type: fulfillment,
        branch_ids: branchMode === "selected" ? form.branchIds : [],
        per_customer_limit: intOrNull(form.perCustomerLimit),
      },
      asDraft ? false : form.isActive,
    );
    if (ok) onClose();
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Edit Discount / Offer" : "New Discount / Offer"}
      description="Create a discount or offer that can be used in POS, website or campaigns."
      width="xl"
      compact
      bannerIcon={<HugeiconsIcon icon={Tag01Icon} size={20} />}
      bodyClassName="bg-paper"
      headerClassName="max-md:!py-space-2 max-md:[&_h2]:text-[15px] max-md:[&_p]:hidden"
      footerClassName="max-md:flex-nowrap max-md:!px-space-3 max-md:[&>*]:!h-10 max-md:[&>*]:!w-auto max-md:[&>*]:flex-1 max-md:[&>*]:!px-space-2 max-md:[&>*]:text-[13px] max-md:[&>*]:whitespace-nowrap"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="ghost" disabled={busy || !form.name.trim()} onClick={() => save(true)}>
            Save as draft
          </Button>
          <Button disabled={busy || !form.name.trim()} onClick={() => save()}>
            {editing ? "Save changes" : "Create discount"}
          </Button>
        </>
      }
    >
      <div className="form-compact space-y-space-2">
        <Section n={1} title="Basic Details">
          <div className="grid gap-space-2 md:grid-cols-2">
            <Field label="Discount Name" htmlFor="d_name" required>
              <Input id="d_name" value={form.name} onChange={(e) => set("name", e.target.value)} />
            </Field>
            <Field label="Description" htmlFor="d_desc">
              <textarea
                id="d_desc"
                rows={1}
                maxLength={500}
                value={form.description}
                onChange={(e) => set("description", e.target.value)}
                className="h-11 w-full resize-none rounded-md border border-line bg-card px-space-3 py-2 text-[13px] leading-5 text-ink-900 shadow-[var(--shadow-sm)] focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </Field>
            <Field label="Code" htmlFor="d_code">
              <div className="flex gap-space-2">
                <Input
                  id="d_code"
                  value={form.code}
                  className="uppercase"
                  onChange={(e) => set("code", e.target.value)}
                />
                <Button
                  variant="ghost"
                  type="button"
                  className="shrink-0 border border-line"
                  onClick={() => set("code", generateCode())}
                >
                  <HugeiconsIcon icon={RefreshIcon} size={16} /> Generate
                </Button>
              </div>
            </Field>
            <div>
              <p className="mb-space-1 text-[13px] font-semibold text-ink-900">Status</p>
              <div className="flex items-center gap-space-3">
                <Switch
                  tone="success"
                  checked={form.isActive}
                  onChange={() => set("isActive", !form.isActive)}
                  aria-label="Active"
                />
                <div>
                  <p className="text-[14px] font-semibold text-ink-900">
                    {form.isActive ? "Active" : "Paused"}
                  </p>
                  <p className="text-[12.5px] text-ink-600">Turn off to pause the offer</p>
                </div>
              </div>
            </div>
          </div>
        </Section>

        <Section n={2} title="Discount Type & Value">
          <div className="grid grid-cols-2 gap-space-2 md:grid-cols-6">
            {(Object.keys(KIND_META) as DiscountKind[]).map((k) => (
              <OptionCard
                key={k}
                tile
                selected={form.kind === k}
                onSelect={() => set("kind", k)}
                title={KIND_LABEL[k]}
                hint={KIND_META[k].hint}
                icon={<HugeiconsIcon icon={KIND_META[k].icon} size={24} />}
              />
            ))}
          </div>
          <div className="mt-space-2 grid gap-space-2 md:grid-cols-3">
            {needsValue && (
              <Field
                label={
                  form.kind === "percent"
                    ? "Percentage (%)"
                    : form.kind === "flat"
                      ? "Amount (₹)"
                      : "Fixed price (₹)"
                }
                htmlFor="d_value"
                required
              >
                <div className="relative">
                  <Input
                    id="d_value"
                    inputMode="decimal"
                    value={form.value}
                    onChange={(e) => set("value", e.target.value)}
                  />
                  {form.kind === "percent" && (
                    <span className="pointer-events-none absolute right-space-3 top-1/2 -translate-y-1/2 text-[14px] text-ink-600">
                      %
                    </span>
                  )}
                </div>
              </Field>
            )}
            {form.kind === "buy_x_get_y" && (
              <>
                <Field label="Buy quantity (X)" htmlFor="d_buy" required>
                  <Input
                    id="d_buy"
                    inputMode="numeric"
                    value={form.buyQty}
                    onChange={(e) => set("buyQty", e.target.value.replace(/\D/g, ""))}
                  />
                </Field>
                <Field label="Free quantity (Y)" htmlFor="d_get" required>
                  <Input
                    id="d_get"
                    inputMode="numeric"
                    value={form.getQty}
                    onChange={(e) => set("getQty", e.target.value.replace(/\D/g, ""))}
                  />
                </Field>
              </>
            )}
            {form.kind === "percent" && (
              <Field label="Maximum discount (₹)" htmlFor="d_max">
                <Input
                  id="d_max"
                  inputMode="decimal"
                  value={form.maxDiscount}
                  onChange={(e) => set("maxDiscount", e.target.value)}
                />
              </Field>
            )}
            <Field label="Minimum order (₹)" htmlFor="d_min">
              <Input
                id="d_min"
                inputMode="decimal"
                value={form.minOrder}
                onChange={(e) => set("minOrder", e.target.value)}
              />
            </Field>
          </div>
        </Section>

        <Section n={3} title="Food Item Eligibility">
          <div className="grid gap-space-2 md:grid-cols-4">
            <OptionCard
              selected={!groupHasScope("product")}
              onSelect={() => selectScope("product", null)}
              title="All food items"
              hint="Applicable on entire menu"
            />
            {eligibility("product")}
          </div>
        </Section>

        <Section n={4} title="Customer Eligibility">
          <div className="grid gap-space-2 md:grid-cols-5">
            <OptionCard
              selected={!groupHasScope("customer")}
              onSelect={() => selectScope("customer", null)}
              title="All customers"
              hint="Anyone can use"
            />
            {eligibility("customer")}
          </div>
        </Section>

        <Section n={5} title="Channels & Branches">
          <div className="grid gap-space-2 md:grid-cols-2">
            <div className="rounded-md border border-line p-space-3">
              <p className="mb-space-2 text-[13px] font-semibold text-ink-900">Sales channel</p>
              <div className="flex flex-wrap gap-x-space-5 gap-y-space-2 text-[14px]">
                {(
                  [
                    ["pos", "POS (in-store)"],
                    ["online", "Website (E-commerce)"],
                    ["whatsapp", "WhatsApp"],
                  ] as const
                ).map(([c, label]) => (
                  <label key={c} className="flex items-center gap-space-2">
                    <input
                      type="checkbox"
                      checked={form.channels.includes(c)}
                      onChange={(e) => toggleChannel(c, e.target.checked)}
                    />
                    {label}
                  </label>
                ))}
                <label className="flex items-center gap-space-2">
                  <input
                    type="checkbox"
                    checked={allChannels}
                    onChange={(e) =>
                      set("channels", e.target.checked ? ["pos", "online", "whatsapp"] : [])
                    }
                  />
                  All
                </label>
              </div>
            </div>
            <div className="rounded-md border border-line p-space-3">
              <p className="mb-space-2 text-[13px] font-semibold text-ink-900">
                Applicable branches
              </p>
              <div className="grid grid-cols-[auto_1fr] items-start gap-x-space-5 text-[14px]">
                <label className="flex items-center gap-space-2">
                  <input
                    type="radio"
                    name="d_branches"
                    checked={branchMode === "all"}
                    onChange={() => setBranchMode("all")}
                  />
                  All branches
                </label>
                <div className="space-y-space-2">
                  <label className="flex items-center gap-space-2">
                    <input
                      type="radio"
                      name="d_branches"
                      checked={branchMode === "selected"}
                      onChange={() => setBranchMode("selected")}
                    />
                    Selected branches
                  </label>
                  {branchMode === "selected" ? (
                    <CheckList
                      items={branches.data.map((b) => ({ id: b.id, label: b.branch_name }))}
                      selected={form.branchIds}
                      onChange={(ids) => set("branchIds", ids)}
                      empty="No branches."
                      placeholder="Select branches"
                    />
                  ) : (
                    <div className="rounded-md border border-line bg-card px-space-3 py-space-2 text-[13px] text-ink-400">
                      Select branches
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="mt-space-2 rounded-md border border-line p-space-3">
            <p className="mb-space-2 text-[13px] font-semibold text-ink-900">Applies to</p>
            <div className="flex flex-wrap gap-x-space-5 gap-y-space-2 text-[14px]">
              {(
                [
                  ["", "All orders"],
                  ["pickup", "Takeaway"],
                  ["dine_in", "Dine in"],
                  ["delivery", "Delivery only"],
                ] as const
              ).map(([v, label]) => (
                <label key={v} className="flex items-center gap-space-2">
                  <input
                    type="radio"
                    name="d_applies"
                    checked={fulfillment === v}
                    onChange={() => setFulfillment(v)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>
        </Section>

        <Section n={6} title="Usage & Combination Rules">
          <div className="grid gap-space-2 md:grid-cols-3">
            <Field label="Total uses allowed" htmlFor="d_use" hint="Leave empty for unlimited">
              <Input
                id="d_use"
                inputMode="numeric"
                value={form.usageLimit}
                onChange={(e) => set("usageLimit", e.target.value.replace(/\D/g, ""))}
              />
            </Field>
            <Field label="Uses per customer" htmlFor="d_pc" hint="Leave empty for unlimited">
              <Input
                id="d_pc"
                inputMode="numeric"
                value={form.perCustomerLimit}
                onChange={(e) => set("perCustomerLimit", e.target.value.replace(/\D/g, ""))}
              />
            </Field>
            <Field label="Minimum purchase quantity" htmlFor="d_minq" hint="Optional">
              <Input
                id="d_minq"
                inputMode="numeric"
                value={form.minQuantity}
                onChange={(e) => set("minQuantity", e.target.value.replace(/\D/g, ""))}
              />
            </Field>
          </div>
          <div className="mt-space-2 grid gap-space-2 md:grid-cols-4">
            <Field
              label="Combine with other discounts"
              htmlFor="d_cd"
              hint="Allow: a shopper can use another code in the same order, if that code allows it too."
            >
              <Select
                id="d_cd"
                value={form.combineDiscounts ? "allow" : "no"}
                onValueChange={(v) => set("combineDiscounts", v === "allow")}
              >
                <option value="no">Do not allow</option>
                <option value="allow">Allow</option>
              </Select>
            </Field>
            <Field
              label="Combine with loyalty points"
              htmlFor="d_cp"
              hint="Do not allow: loyalty points cannot be used on an order that uses this code."
            >
              <Select
                id="d_cp"
                value={form.combinePoints ? "allow" : "no"}
                onValueChange={(v) => set("combinePoints", v === "allow")}
              >
                <option value="no">Do not allow</option>
                <option value="allow">Allow</option>
              </Select>
            </Field>
            <Field
              label="Priority"
              htmlFor="d_prio"
              hint="When codes are used together, the higher priority is applied first and wins if they cannot be combined. It is also listed first to shoppers."
            >
              <Select
                id="d_prio"
                value={form.priority}
                onValueChange={(v) => set("priority", v as Form["priority"])}
              >
                <option value="low">Low</option>
                <option value="normal">Normal</option>
                <option value="high">High</option>
              </Select>
            </Field>
            <div>
              <p className="mb-space-1 text-[13px] font-semibold text-ink-900">Apply on</p>
              <div className="space-y-space-1 text-[14px]">
                <label className="flex items-center gap-space-2">
                  <input
                    type="radio"
                    name="d_apply"
                    checked={form.applyOn === "subtotal"}
                    onChange={() => set("applyOn", "subtotal")}
                  />
                  Subtotal (before tax)
                </label>
                <label className="flex items-center gap-space-2">
                  <input
                    type="radio"
                    name="d_apply"
                    checked={form.applyOn === "total"}
                    onChange={() => set("applyOn", "total")}
                  />
                  Total amount (after tax)
                </label>
              </div>
              <p className="mt-space-1 text-[12.5px] text-ink-600">
                Matters for a flat amount, the maximum discount and the minimum order when your
                prices are listed before tax. With tax-inclusive prices both mean the listed price,
                and a percentage costs the same either way.
              </p>
            </div>
          </div>
        </Section>

        <Section n={7} title="Validity" aside>
          <div className="grid flex-1 gap-space-2 md:grid-cols-2">
            <DateTimeField
              id="d_start"
              label="Start date & time"
              value={form.startsAt}
              onChange={(v) => set("startsAt", v)}
            />
            <DateTimeField
              id="d_end"
              label="End date & time"
              value={form.endsAt}
              onChange={(v) => set("endsAt", v)}
              defaultTime="23:59"
            />
          </div>
        </Section>

        <Section n={8} title="Review & Summary" aside>
          <div className="flex flex-1 items-start gap-space-3 rounded-md border border-brand-200 bg-brand-50 p-space-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-800 text-white">
              <HugeiconsIcon icon={Tag01Icon} size={18} />
            </span>
            <div className="min-w-0 text-[13px] text-ink-600">
              <p className="text-[14px] font-bold text-ink-900">
                {form.name.trim() || "Untitled discount"}
                {form.code.trim() && ` (${form.code.trim().toUpperCase()})`}
              </p>
              <p>{summaryLine}</p>
            </div>
          </div>
        </Section>
      </div>
    </Modal>
  );
}
