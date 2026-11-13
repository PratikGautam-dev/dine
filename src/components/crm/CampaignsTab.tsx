"use client";

import {
  Add01Icon,
  Calendar03Icon,
  ChartBarLineIcon,
  FlashIcon,
  Layers01Icon,
  MoreHorizontalIcon,
  Search01Icon,
  ViewIcon,
  CrownIcon,
  Globe02Icon,
  Mail01Icon,
  Megaphone01Icon,
  Message01Icon,
  PackageIcon,
  Store01Icon,
  Tag01Icon,
  UserIcon,
  Comment01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import type { ColumnDef } from "@tanstack/react-table";
import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CampaignKpis,
  CampaignPerformance,
  ChannelIcons,
  Panel,
  RecentActivity,
  StagePill,
  channelsOf,
  stageOf,
} from "@/components/crm/campaignView";
import { MessageList } from "@/components/crm/shared";
import { WhatsAppIcon } from "@/components/portal/WhatsAppIcon";
import { Button } from "@/components/erp-ui/Button";
import { Card } from "@/components/erp-ui/Card";
import { ConfirmDialog } from "@/components/erp-ui/ConfirmDialog";
import { DataTable } from "@/components/erp-ui/DataTable";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/erp-ui/dropdown-menu";
import {
  DateTimeField,
  isoToLocalInput,
  localInputToIso,
} from "@/components/erp-ui/DateTimeField";
import {
  CustomerMultiSelect,
  type PickedCustomer,
} from "@/components/erp/CustomerMultiSelect";
import { Field } from "@/components/erp-ui/Field";
import { OptionCard, Section, generateCode } from "@/components/erp-ui/FormSection";
import { Input } from "@/components/erp-ui/Input";
import { Modal } from "@/components/erp-ui/Modal";
import { PageHeader } from "@/components/erp-ui/PageHeader";
import { MultiSelect } from "@/components/erp-ui/MultiSelect";
import { Select } from "@/components/erp-ui/Select";
import {
  SEGMENT_META,
  SEGMENT_ORDER,
  TEXTAREA_CLASS,
  formatDate,
  type Campaign,
  type CampaignAudience,
  type CampaignChannel,
  type CampaignObjective,
  type CampaignType,
  type CrmCustomer,
  type CrmMessage,
  type Segment,
} from "@/lib/erp/crm";
import { discountOffer, discountSummary } from "@/lib/erp/discountSummary";
import { erp, toMinor, useErpQuery, type Discount } from "@/lib/erp/erp";
import type { SavedSegment } from "@/lib/erp/rules";
import { cn } from "@/lib/cn";
import { hasGrant, useStaffSession } from "@/lib/erp/staffAuth";
import { toast } from "@/lib/toast";

const MESSAGING: CampaignChannel[] = ["whatsapp", "email", "sms"];

const CHANNELS: { key: CampaignChannel; label: string; icon: ReactNode }[] = [
  { key: "whatsapp", label: "WhatsApp", icon: <WhatsAppIcon size={22} /> },
  {
    key: "email",
    label: "Email",
    icon: <HugeiconsIcon icon={Mail01Icon} size={22} />,
  },
  {
    key: "sms",
    label: "SMS",
    icon: <HugeiconsIcon icon={Message01Icon} size={22} />,
  },
  {
    key: "pos",
    label: "POS",
    icon: <HugeiconsIcon icon={Store01Icon} size={22} />,
  },
  {
    key: "website",
    label: "Website",
    icon: <HugeiconsIcon icon={Globe02Icon} size={22} />,
  },
];
const CHANNEL_LABEL = Object.fromEntries(
  CHANNELS.map((c) => [c.key, c.label]),
) as Record<CampaignChannel, string>;

const TYPES: {
  key: CampaignType;
  label: string;
  hint: string;
  icon: typeof Tag01Icon;
}[] = [
  {
    key: "discount",
    label: "Discount campaign",
    hint: "Promote a discount or offer",
    icon: Tag01Icon,
  },
  {
    key: "loyalty",
    label: "Loyalty campaign",
    hint: "Bonus points, rewards",
    icon: CrownIcon,
  },
  {
    key: "message",
    label: "Message campaign",
    hint: "Inform or engage customers",
    icon: Comment01Icon,
  },
  {
    key: "launch",
    label: "New product launch",
    hint: "Announce new arrivals",
    icon: PackageIcon,
  },
  {
    key: "event",
    label: "Event campaign",
    hint: "Special event or sale",
    icon: Calendar03Icon,
  },
];

/** The short name of a campaign type, for the list. */
const TYPE_SHORT: Record<string, string> = {
  discount: "Discount",
  loyalty: "Loyalty",
  message: "Message",
  launch: "New Product",
  event: "Event",
};

const OBJECTIVES: [CampaignObjective, string][] = [
  ["sales", "Increase sales"],
  ["retention", "Customer retention"],
  ["loyalty", "Loyalty & rewards"],
  ["launch", "Promote a new product"],
  ["reactivation", "Win back inactive customers"],
  ["awareness", "Brand awareness"],
];

const TOKENS = [
  "{{name}}",
  "{{code}}",
  "{{discount}}",
  "{{expiry_date}}",
  "{{store_name}}",
  "{{occasion}}",
  "{{occasion_date}}",
  "{{product}}",
];

type Form = {
  name: string;
  objective: CampaignObjective;
  description: string;
  type: CampaignType;
  /** Customer type "Individuals": the campaign goes to just the customers chosen below, and the filters don't apply to them. */
  individuals: boolean;
  customers: PickedCustomer[];
  /** Any of these memberships; none = everyone. */
  segments: string[];
  /** A saved segment (Customers > Segments) that narrows the group. */
  segmentId: string;
  tag: string;
  /** Only a campaign saved with the old customer types ("individual" / "business") has one; it is kept as it was. */
  customerType: string;
  onlyNew: boolean;
  city: string;
  purchase: string;
  gender: string;
  since: string;
  discountMode: "existing" | "new";
  discountId: string;
  newName: string;
  newCode: string;
  newKind: "percent" | "flat";
  newValue: string;
  newMinOrder: string;
  channels: CampaignChannel[];
  message: string;
  startsAt: string;
  endsAt: string;
  /** Automated campaign: what launches it ("" = a person launches it). */
  trigger: "" | NonNullable<Campaign["trigger"]>["type"];
  daysBefore: string;
  /** Birthday/anniversary: how many times it is sent per occasion ("1" to "3") and the days between those sends. */
  sends: string;
  intervalDays: string;
  /** Anniversary trigger: only anniversaries with this label ("" = any). */
  anniversaryLabel: string;
};
const EMPTY: Form = {
  name: "",
  objective: "sales",
  description: "",
  type: "discount",
  individuals: false,
  customers: [],
  segments: [],
  segmentId: "",
  tag: "",
  customerType: "",
  onlyNew: false,
  city: "",
  purchase: "",
  gender: "",
  since: "",
  discountMode: "existing",
  discountId: "",
  newName: "",
  newCode: "",
  newKind: "percent",
  newValue: "",
  newMinOrder: "",
  channels: ["whatsapp", "email"],
  message: "Hi {{name}}, ",
  startsAt: "",
  endsAt: "",
  trigger: "",
  daysBefore: "7",
  sends: "1",
  intervalDays: "3",
  anniversaryLabel: "",
};

/** A trigger in words: "7 days before a birthday". */
function triggerLabel(t: Campaign["trigger"]) {
  if (!t) return "";
  if (t.type === "new_arrival")
    return "When a product is added to New Arrivals";
  const what =
    t.type === "birthday"
      ? "birthday"
      : t.label
        ? `${t.label} anniversary`
        : "anniversary";
  const n = t.days_before ?? 0;
  const sends = t.sends ?? 1;
  const base =
    n === 0
      ? `On the customer's ${what}`
      : `${n} day${n === 1 ? "" : "s"} before a customer's ${what}`;
  const gap = t.interval_days ?? 3;
  return sends > 1
    ? `${base}, ${sends} times, ${gap} day${gap === 1 ? "" : "s"} apart`
    : base;
}

const audienceOf = (f: Form): CampaignAudience =>
  f.individuals
    ? { customer_ids: f.customers.map((c) => c.id) }
    : {
        ...(f.segments.length ? { segments: f.segments as Segment[] } : {}),
        ...(f.segmentId ? { segment_id: f.segmentId } : {}),
        ...(f.tag ? { tag: f.tag } : {}),
        ...(f.customerType
          ? { customer_type: f.customerType as "individual" | "business" }
          : {}),
        ...(f.onlyNew ? { only_new: true } : {}),
        ...(f.city ? { city: f.city } : {}),
        ...(f.purchase
          ? {
              purchase: f.purchase as NonNullable<CampaignAudience["purchase"]>,
            }
          : {}),
        ...(f.gender
          ? { gender: f.gender as NonNullable<CampaignAudience["gender"]> }
          : {}),
        ...(f.since
          ? { since: f.since as NonNullable<CampaignAudience["since"]> }
          : {}),
      };

function audienceLabel(a: Campaign["audience"]) {
  const customers = a.customer_ids?.length ?? (a.customer_id ? 1 : 0);
  if (customers)
    return customers === 1 ? "Individual customer" : `${customers} customers`;
  const segments = a.segments?.length
    ? a.segments
    : a.segment
      ? [a.segment]
      : [];
  const parts = [
    segments.length
      ? segments.map((s) => SEGMENT_META[s].label).join(", ")
      : null,
    a.segment_id ? "saved segment" : null,
    a.tag ? `tag: ${a.tag}` : null,
    a.customer_type ? `${a.customer_type} customers` : null,
    a.city ?? null,
  ].filter(Boolean);
  return parts.length ? parts.join(" + ") : "All customers";
}

/** The customers with these ids, in the order given; one that can no longer be found stays, shown as "Customer", so it is not dropped silently. */
async function loadPicked(ids: string[]): Promise<PickedCustomer[]> {
  const found = new Map<string, PickedCustomer>();
  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    const res = await erp<{ items: CrmCustomer[] }>(
      `/api/v1/crm/customers?limit=200&${chunk.map((id) => `ids=${encodeURIComponent(id)}`).join("&")}`,
    );
    for (const c of res.data?.items ?? []) found.set(c.id, c);
  }
  return ids.map((id) => found.get(id) ?? { id, name: "Customer" });
}

const shortDate = (v: string) =>
  new Date(v).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export function CampaignsTab({
  canEdit,
  onChanged,
}: {
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [tab, setTab] = useState<"all" | "automated">("all");
  const [stageFilter, setStageFilter] = useState("");
  const [search, setSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [range, setRange] = useState("");
  const [allActivity, setAllActivity] = useState(false);
  const campaigns = useErpQuery<Campaign[]>("/api/v1/crm/campaigns");
  // Sending reaches real customers: its own permission (drafting needs customers write).
  const canSend = hasGrant(useStaffSession(), "customers:send_campaigns");
  const tags =
    useErpQuery<{ tag: string; customers: number }[]>("/api/v1/crm/tags");
  const discounts = useErpQuery<Discount[]>("/api/v1/discounts");
  const savedSegments = useErpQuery<SavedSegment[]>(
    "/api/v1/crm/customer-segments",
  );
  const options = useErpQuery<{
    cities: string[];
    anniversary_labels?: string[];
  }>("/api/v1/crm/audience-options");
  const [editing, setEditing] = useState<Campaign | "new" | null>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState<Campaign | null>(null);
  const [deleting, setDeleting] = useState<Campaign | null>(null);
  const [viewing, setViewing] = useState<Campaign | null>(null);
  // a sent campaign: only its name, objective, offer and schedule can change
  const [detailing, setDetailing] = useState<Campaign | null>(null);
  const [details, setDetails] = useState({
    name: "",
    description: "",
    objective: "sales" as CampaignObjective,
    discountId: "",
    startsAt: "",
    endsAt: "",
  });
  const [showPreview, setShowPreview] = useState(true);
  const log = useErpQuery<CrmMessage[]>(
    viewing ? `/api/v1/crm/messages?campaign_id=${viewing.id}` : null,
  );
  const logCounts = useMemo(() => {
    const rows = log.data ?? [];
    const is = (...st: string[]) =>
      rows.filter((m) => st.includes(m.status)).length;
    return {
      total: rows.length,
      delivered: is("delivered", "read"),
      read: is("read"),
      failed: is("failed"),
    };
  }, [log.data]);
  const [audience, setAudience] = useState<{
    total: number;
    reachable: number;
  } | null>(null);
  const whatsapp = form.channels.includes("whatsapp");
  const primary: CampaignChannel =
    form.channels.find((c) => MESSAGING.includes(c)) ?? "whatsapp";

  // a campaign that is going out: refresh until it's done, so the counts move on their own
  const { reload: reloadCampaigns } = campaigns;
  const anySending = (campaigns.data ?? []).some((k) => k.status === "sending");
  useEffect(() => {
    if (!anySending) return;
    const timer = setInterval(reloadCampaigns, 5000);
    return () => clearInterval(timer);
  }, [anySending, reloadCampaigns]);

  const nobodyChosen = form.individuals && form.customers.length === 0;
  const estimate = nobodyChosen ? { total: 0, reachable: 0 } : audience;

  // the estimated audience follows the filters
  const audienceKey = JSON.stringify([audienceOf(form), primary]);
  useEffect(() => {
    if (editing === null) return;
    const wanted: CampaignAudience = JSON.parse(audienceKey)[0];
    if (wanted.customer_ids && wanted.customer_ids.length === 0) return; // nobody chosen yet: nothing to ask the server
    let cancelled = false;
    erp<{ total: number; reachable: number }>(
      "/api/v1/crm/audience-preview",
      "POST",
      { channel: primary, audience: wanted },
    ).then((r) => {
      if (!cancelled) setAudience(r.data);
    });
    return () => {
      cancelled = true;
    };
  }, [editing, audienceKey, primary]);

  function openNew(automated = false) {
    options.reload(); // the cities and anniversary kinds may have changed since the page opened
    setForm(automated ? { ...EMPTY, trigger: "birthday" } : EMPTY);
    setAudience(null);
    setEditing("new");
  }
  /** Opens the full editor on `k`; `copy` starts a new draft from it instead (the old schedule is dropped). */
  function openEdit(k: Campaign, copy = false) {
    options.reload();
    const a = k.audience;
    setForm({
      ...EMPTY,
      name: copy ? `${k.name} (copy)` : k.name,
      objective: k.objective,
      description: k.description ?? "",
      type: k.campaign_type,
      individuals: !!(a.customer_ids?.length || a.customer_id),
      segments: a.segments?.length ? a.segments : a.segment ? [a.segment] : [],
      segmentId: a.segment_id ?? "",
      tag: a.tag ?? "",
      customerType: a.customer_type ?? "",
      onlyNew: a.only_new ?? false,
      city: a.city ?? "",
      purchase: a.purchase ?? "",
      gender: a.gender ?? "",
      since: a.since ?? "",
      discountId: k.discount_id ?? "",
      channels: k.channels?.length ? k.channels : [k.channel],
      message: k.message,
      startsAt: copy ? "" : isoToLocalInput(k.starts_at),
      endsAt: copy ? "" : isoToLocalInput(k.ends_at),
      trigger: k.trigger?.type ?? "",
      daysBefore: String(k.trigger?.days_before ?? 7),
      sends: String(k.trigger?.sends ?? 1),
      intervalDays: String(k.trigger?.interval_days ?? 3),
      anniversaryLabel: k.trigger?.label ?? "",
    });
    setAudience(null);
    setEditing(copy ? "new" : k);
    // the chosen customers are saved as ids: look their names up so they can be shown (and removed) here
    const ids = a.customer_ids?.length
      ? a.customer_ids
      : a.customer_id
        ? [a.customer_id]
        : [];
    if (ids.length)
      void loadPicked(ids).then((customers) =>
        setForm((f) => (f.individuals ? { ...f, customers } : f)),
      );
  }

  const withCode = (discounts.data ?? []).filter((d) => d.code && d.is_active);
  const picked = withCode.find((d) => d.id === form.discountId);
  const discountRequired = form.type === "discount";
  const text = form.message;

  /** The campaign saved as a draft (the discount made first when "create a new discount" is chosen); null when something is missing. */
  async function persist(): Promise<Campaign | null> {
    const fail = (title: string, detail?: string) => {
      toast.error(title, detail);
      return null;
    };
    if (!form.channels.some((c) => MESSAGING.includes(c)))
      return fail(
        "Pick a channel that sends messages",
        "Choose WhatsApp, Email or SMS. POS and Website only show the offer.",
      );
    if (form.individuals && form.customers.length === 0)
      return fail(
        "Choose the customers",
        "Pick at least one customer, or set Customer type to All customers.",
      );
    if (!text.trim()) return fail("Write the message");
    if (
      !form.trigger &&
      form.startsAt &&
      form.endsAt &&
      form.endsAt <= form.startsAt
    )
      return fail("Check the schedule", "The end must be after the start.");
    const days = Number(form.daysBefore);
    if (
      (form.trigger === "birthday" || form.trigger === "anniversary") &&
      !(Number.isInteger(days) && days >= 0 && days <= 60)
    )
      return fail("Check the trigger", "Days before must be from 0 to 60.");
    const sends = Number(form.sends);
    const gap = Number(form.intervalDays);
    if (
      (form.trigger === "birthday" || form.trigger === "anniversary") &&
      sends > 1
    ) {
      if (!(Number.isInteger(gap) && gap >= 1 && gap <= 14))
        return fail("Check the trigger", "Days between sends must be 1 to 14.");
      if (days - (sends - 1) * gap < 0)
        return fail(
          "Check the trigger",
          "The last send would fall after the day itself. Use more days before, fewer sends or a shorter interval.",
        );
    }
    if (
      discountRequired &&
      form.discountMode === "existing" &&
      !form.discountId
    )
      return fail("Select a discount");

    setBusy(true);
    let discountId = form.discountMode === "existing" ? form.discountId : "";
    if (form.discountMode === "new") {
      const percent = form.newKind === "percent";
      const value = percent ? Number(form.newValue) : toMinor(form.newValue);
      if (!(value && value > 0 && (!percent || value <= 100))) {
        setBusy(false);
        return fail(
          "Check the discount value",
          percent
            ? "A percentage must be between 0 and 100."
            : "Enter an amount above zero.",
        );
      }
      const made = await erp<Discount>("/api/v1/discounts", "POST", {
        name: form.newName.trim() || form.name.trim(),
        code: form.newCode.trim() || generateCode(),
        kind: form.newKind,
        value,
        min_order_minor: form.newMinOrder.trim()
          ? (toMinor(form.newMinOrder) ?? 0)
          : 0,
        starts_at: localInputToIso(form.startsAt),
        ends_at: localInputToIso(form.endsAt),
      });
      if (made.error || !made.data) {
        setBusy(false);
        return fail("Couldn't create the discount", made.error ?? undefined);
      }
      discountId = made.data.id;
      // saved: from here on it's an existing discount, so a retry doesn't make a second one
      setForm((f) => ({ ...f, discountMode: "existing", discountId }));
      discounts.reload();
    }
    const body = {
      name: form.name.trim(),
      channel: primary,
      channels: form.channels,
      description: form.description.trim() || null,
      objective: form.objective,
      campaign_type: form.type,
      audience: audienceOf(form),
      subject: null,
      message: text.trim(),
      discount_id: discountId || null,
      starts_at: form.trigger ? null : localInputToIso(form.startsAt),
      ends_at: form.trigger ? null : localInputToIso(form.endsAt),
      trigger: form.trigger
        ? {
            type: form.trigger,
            ...(form.trigger === "new_arrival" ? {} : { days_before: days }),
            ...(form.trigger !== "new_arrival" && sends > 1
              ? { sends, interval_days: gap }
              : {}),
            ...(form.trigger === "anniversary" && form.anniversaryLabel
              ? { label: form.anniversaryLabel }
              : {}),
          }
        : null,
    };
    const res =
      editing === "new"
        ? await erp<Campaign>("/api/v1/crm/campaigns", "POST", body)
        : await erp<Campaign>(
            `/api/v1/crm/campaigns/${(editing as Campaign).id}`,
            "PUT",
            body,
          );
    setBusy(false);
    if (res.error || !res.data)
      return fail("Couldn't save the campaign", res.error ?? undefined);
    campaigns.reload();
    return res.data;
  }

  function openDetails(k: Campaign) {
    setDetails({
      name: k.name,
      description: k.description ?? "",
      objective: k.objective,
      discountId: k.discount_id ?? "",
      startsAt: isoToLocalInput(k.starts_at),
      endsAt: isoToLocalInput(k.ends_at),
    });
    setDetailing(k);
  }
  async function saveDetails() {
    if (!detailing) return;
    if (!details.name.trim()) return toast.error("Name the campaign");
    if (
      details.startsAt &&
      details.endsAt &&
      details.endsAt <= details.startsAt
    )
      return toast.error(
        "Check the schedule",
        "The end must be after the start.",
      );
    setBusy(true);
    const res = await erp<Campaign>(
      `/api/v1/crm/campaigns/${detailing.id}/details`,
      "PATCH",
      {
        name: details.name.trim(),
        description: details.description.trim() || null,
        objective: details.objective,
        discount_id: details.discountId || null,
        starts_at: localInputToIso(details.startsAt),
        ends_at: localInputToIso(details.endsAt),
      },
    );
    setBusy(false);
    if (res.error || !res.data)
      return toast.error("Couldn't save the campaign", res.error ?? undefined);
    campaigns.reload();
    toast.success("Campaign updated");
    setDetailing(null);
  }
  async function saveDraft() {
    const k = await persist();
    if (!k) return;
    toast.success("Draft saved");
    setEditing(null);
  }
  /** Saves, then asks for the final go-ahead before anything is sent. */
  async function launch() {
    const k = await persist();
    if (!k) return;
    setEditing(null);
    if (k.trigger) {
      toast.success(
        "Automation is on",
        `${triggerLabel(k.trigger)}: it launches by itself, no need to send it.`,
      );
      return;
    }
    setSending(k);
  }
  async function setAutomation(k: Campaign, active: boolean) {
    const res = await erp<Campaign>(
      `/api/v1/crm/campaigns/${k.id}/automation`,
      "PATCH",
      { active },
    );
    if (res.error)
      return toast.error("Couldn't update the campaign", res.error);
    toast.success(active ? "Automation resumed" : "Automation paused");
    campaigns.reload();
  }

  const insertToken = (token: string) => {
    setForm({ ...form, message: `${form.message}${token}` });
  };
  const sample = (t: string) =>
    t
      .replaceAll("{{name}}", "Priya")
      .replaceAll("{{code}}", picked?.code ?? "CODE")
      .replaceAll("{{discount}}", picked ? discountOffer(picked) : "your offer")
      .replaceAll(
        "{{expiry_date}}",
        form.endsAt ? shortDate(form.endsAt) : "the end date",
      )
      .replaceAll("{{store_name}}", "our store")
      .replaceAll("{{occasion}}", "Wedding")
      .replaceAll("{{occasion_date}}", "15 Feb")
      .replaceAll("{{product}}", "Silk Saree");

  async function send() {
    if (!sending) return;
    setBusy(true);
    const res = await erp<Campaign>(
      `/api/v1/crm/campaigns/${sending.id}/send`,
      "POST",
    );
    setBusy(false);
    setSending(null);
    if (res.error) return toast.error("Couldn't send the campaign", res.error);
    const k = res.data!;
    if (k.status === "sending")
      toast.success(
        `Sending to ${k.recipient_count} customers`,
        "The messages go out over the next minute. Delivered and read counts update here.",
      );
    else if (k.delivered_count === k.recipient_count)
      toast.success(`Sent to ${k.delivered_count} customers`);
    else
      toast.info(
        `${k.recipient_count} messages recorded`,
        `${k.delivered_count} delivered. The rest were saved but not delivered — see Messages for the reason.`,
      );
    campaigns.reload();
    onChanged();
  }

  async function remove() {
    if (!deleting) return;
    const res = await erp(`/api/v1/crm/campaigns/${deleting.id}`, "DELETE");
    setDeleting(null);
    if (res.error) return toast.error("Couldn't delete", res.error);
    toast.success("Campaign deleted");
    campaigns.reload();
  }

  const columns = useMemo<ColumnDef<Campaign, unknown>[]>(
    () => [
      {
        header: "Campaign Name",
        cell: ({ row }) => (
          <span className="flex items-center gap-space-2">
            <HugeiconsIcon
              icon={Megaphone01Icon}
              size={16}
              className="shrink-0 text-brand-700"
            />
            <span className="min-w-0">
              <span className="block font-semibold text-ink-900">
                {row.original.name}
              </span>
              {row.original.description && (
                <span className="block max-w-[260px] truncate text-[12px] text-ink-600">
                  {row.original.description}
                </span>
              )}
            </span>
          </span>
        ),
      },
      {
        header: "Type",
        cell: ({ row }) => (
          <span className="rounded-md bg-ink-50 px-space-2 py-0.5 text-[12px] font-medium text-ink-800">
            {TYPE_SHORT[row.original.campaign_type] ??
              row.original.campaign_type}
          </span>
        ),
      },
      {
        header: "Audience",
        cell: ({ row }) => (
          <span className="flex items-center gap-space-2 text-ink-700">
            <HugeiconsIcon icon={UserIcon} size={14} className="text-ink-400" />
            <span>
              {row.original.status === "draft"
                ? audienceLabel(row.original.audience)
                : row.original.recipient_count.toLocaleString("en-IN")}
            </span>
          </span>
        ),
      },
      {
        header: "Channels",
        cell: ({ row }) => <ChannelIcons k={row.original} />,
      },
      {
        header: "Offer / Discount",
        cell: ({ row }) =>
          row.original.discount_code ?? <span className="text-ink-400">—</span>,
      },
      {
        header: "Schedule / Trigger",
        cell: ({ row }) => {
          const k = row.original;
          if (k.trigger)
            return (
              <span className="text-ink-700">{triggerLabel(k.trigger)}</span>
            );
          const from = k.starts_at ?? k.sent_at;
          return from ? (
            <span className="text-ink-700">
              {formatDate(from)}
              {k.ends_at ? ` – ${formatDate(k.ends_at)}` : ""}
            </span>
          ) : (
            <span className="text-ink-400">—</span>
          );
        },
      },
      {
        header: "Status",
        cell: ({ row }) =>
          row.original.trigger ? (
            <span
              className={cn(
                "inline-flex items-center rounded-md px-space-2 py-0.5 text-[12px] font-semibold",
                row.original.automation_active
                  ? "bg-success-tint text-success"
                  : "bg-ink-50 text-ink-600",
              )}
            >
              {row.original.automation_active ? "Active" : "Paused"}
            </span>
          ) : (
            <StagePill
              stage={stageOf(row.original)}
              sending={row.original.status === "sending"}
            />
          ),
      },
      {
        id: "actions",
        header: "Actions",
        meta: { className: "!min-w-0" },
        cell: ({ row }) => {
          const k = row.original;
          return (
            <span className="flex items-center justify-start gap-space-1">
              {(k.status !== "draft" ||
                (k.trigger && k.recipient_count > 0)) && (
                <button
                  type="button"
                  aria-label={`View messages for ${k.name}`}
                  title="View messages"
                  onClick={() => setViewing(k)}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-ink-600 hover:bg-black/[0.05] focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none"
                >
                  <HugeiconsIcon icon={ViewIcon} size={16} />
                </button>
              )}
              {k.status === "draft" &&
                !(k.trigger && k.recipient_count > 0) && (
                  <span aria-hidden className="h-8 w-8 shrink-0" />
                )}
              {canEdit && (
                <DropdownMenu>
                  <DropdownMenuTrigger
                    aria-label={`Actions for ${k.name}`}
                    className="flex h-8 w-8 items-center justify-center rounded-md text-ink-600 hover:bg-black/[0.05] focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:outline-none"
                  >
                    <HugeiconsIcon icon={MoreHorizontalIcon} size={18} />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem
                      disabled={k.status === "sending"}
                      onClick={() =>
                        k.status === "draft" ? openEdit(k) : openDetails(k)
                      }
                    >
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openEdit(k, true)}>
                      Copy
                    </DropdownMenuItem>
                    {k.status === "draft" && canSend && !k.trigger && (
                      <DropdownMenuItem onClick={() => setSending(k)}>
                        Send
                      </DropdownMenuItem>
                    )}
                    {k.trigger && canSend && (
                      <DropdownMenuItem
                        onClick={() =>
                          void setAutomation(k, !k.automation_active)
                        }
                      >
                        {k.automation_active ? "Pause" : "Resume"}
                      </DropdownMenuItem>
                    )}
                    {k.status === "draft" && (
                      <DropdownMenuItem onClick={() => setDeleting(k)}>
                        Delete
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </span>
          );
        },
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [canEdit, canSend],
  );

  const all = useMemo(() => campaigns.data ?? [], [campaigns.data]);
  const [openedAt] = useState(() => Date.now());
  const cutoff = range ? openedAt - Number(range) * 86_400_000 : 0;
  const shown = all.filter(
    (k) =>
      (tab === "all" || !!k.trigger) &&
      (!stageFilter || stageOf(k) === stageFilter) &&
      (!channelFilter ||
        channelsOf(k).includes(channelFilter as CampaignChannel)) &&
      (!typeFilter || k.campaign_type === typeFilter) &&
      (!cutoff || Date.parse(k.created_at) >= cutoff) &&
      `${k.name} ${k.description ?? ""} ${k.discount_code ?? ""}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  const TABS: {
    key: typeof tab;
    label: string;
    icon: typeof Megaphone01Icon;
  }[] = [
    {
      key: "all",
      label: `Manual Campaigns (${all.length})`,
      icon: Layers01Icon,
    },
    {
      key: "automated",
      label: `Automated Campaigns (${all.filter((k) => k.trigger).length})`,
      icon: FlashIcon,
    },
  ];

  return (
    <div>
      <PageHeader
        icon={<HugeiconsIcon icon={Megaphone01Icon} size={20} />}
        title="Campaigns"
        description="Create, manage and track marketing campaigns across WhatsApp, Email, SMS, POS and Website."
        actions={
          canEdit && (
            <Button
              onClick={() => openNew(tab === "automated")}
              className="shrink-0 whitespace-nowrap"
            >
              <HugeiconsIcon icon={Add01Icon} size={16} className="shrink-0" />{" "}
              {tab === "automated" ? "Add automated campaign" : "Add campaign"}
            </Button>
          )
        }
      />
      <CampaignKpis list={campaigns.data ?? undefined} />
      <div
        role="tablist"
        className="no-scrollbar mb-space-4 flex gap-space-1 overflow-x-auto border-b border-line"
      >
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            type="button"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "-mb-px flex shrink-0 items-center gap-space-2 rounded-t-lg border-b-2 px-space-4 py-space-2 text-[14px] font-semibold transition-colors",
              tab === t.key
                ? "border-brand-600 bg-brand-50 text-brand-700"
                : "border-transparent text-ink-600 hover:text-ink-900",
            )}
          >
            <HugeiconsIcon icon={t.icon} size={16} />
            {t.label}
          </button>
        ))}
      </div>
      {campaigns.error && (
        <p className="mb-space-3 text-[13px] font-medium text-error">
          {campaigns.error}
        </p>
      )}
      {
        <>
          <Card className="mb-space-3 flex flex-wrap items-end gap-space-3 p-space-3 max-md:grid max-md:grid-cols-2 xl:flex-nowrap">
            <span className="relative min-w-[220px] flex-1 self-end max-md:col-span-2 max-md:min-w-0">
              <HugeiconsIcon
                icon={Search01Icon}
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400"
              />
              <Input
                placeholder="Search campaigns by name, offer or code…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                aria-label="Search campaigns"
              />
            </span>
            <label className="flex min-w-0 flex-col gap-1 text-[12px] font-semibold text-ink-900">
              Channel
              <Select
                value={channelFilter}
                onValueChange={setChannelFilter}
                className="!w-[150px] max-md:!w-full max-md:!px-space-2"
                aria-label="Channel"
              >
                <option value="">All channels</option>
                {CHANNELS.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex min-w-0 flex-col gap-1 text-[12px] font-semibold text-ink-900">
              Campaign Type
              <Select
                value={typeFilter}
                onValueChange={setTypeFilter}
                className="!w-[170px] max-md:!w-full max-md:!px-space-2"
                aria-label="Campaign type"
              >
                <option value="">All types</option>
                {TYPES.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="flex min-w-0 flex-col gap-1 text-[12px] font-semibold text-ink-900">
              Status
              <Select
                value={stageFilter}
                onValueChange={setStageFilter}
                className="!w-[150px] max-md:!w-full max-md:!px-space-2"
                aria-label="Status"
              >
                <option value="">All statuses</option>
                <option value="draft">Draft</option>
                <option value="scheduled">Scheduled</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
              </Select>
            </label>
            <label className="flex min-w-0 flex-col gap-1 text-[12px] font-semibold text-ink-900">
              Date Range
              <span className="relative max-md:block">
                <HugeiconsIcon
                  icon={Calendar03Icon}
                  size={16}
                  className="pointer-events-none absolute top-1/2 left-3 z-10 -translate-y-1/2 text-ink-600"
                />
                <Select
                  value={range}
                  onValueChange={setRange}
                  className="!w-[160px] !pl-9 max-md:!w-full max-md:!pr-space-2"
                  aria-label="Date range"
                >
                  <option value="">All time</option>
                  <option value="7">Last 7 days</option>
                  <option value="30">Last 30 days</option>
                  <option value="90">Last 90 days</option>
                </Select>
              </span>
            </label>
          </Card>
          <Card className="p-space-2">
            <div className="whitespace-nowrap">
              <DataTable
                columns={columns}
                data={shown}
                getRowId={(k) => k.id}
                loading={campaigns.loading}
                emptyMessage={
                  campaigns.loading
                    ? "Loading campaigns…"
                    : all.length
                      ? "No campaigns match."
                      : "No campaigns yet."
                }
              />
            </div>
          </Card>
          {tab === "all" && all.length > 0 && (
            <div className="mt-space-4 grid gap-space-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <Panel
                icon={<HugeiconsIcon icon={ChartBarLineIcon} size={18} />}
                title="Campaign Performance"
                subtitle="What your sent campaigns reached."
              >
                <CampaignPerformance list={all} />
              </Panel>
              <Panel
                icon={<HugeiconsIcon icon={FlashIcon} size={18} />}
                title="Recent Activity"
                action={{
                  label: allActivity ? "Show less" : "View all",
                  onClick: () => setAllActivity(!allActivity),
                }}
              >
                <RecentActivity list={all} limit={allActivity ? 50 : 6} />
              </Panel>
            </div>
          )}
        </>
      }

      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing === "new" ? "New Campaign" : "Edit Campaign"}
        description="Create a marketing campaign and use an existing discount or create a new one."
        width="xl"
        compact
        bannerIcon={<HugeiconsIcon icon={Megaphone01Icon} size={20} />}
        bodyClassName="bg-paper"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            {!form.trigger && (
              <Button
                variant="ghost"
                disabled={busy || !form.name.trim()}
                onClick={saveDraft}
              >
                Save as draft
              </Button>
            )}
            <Button
              disabled={busy || !form.name.trim() || !canSend}
              title={
                canSend
                  ? undefined
                  : "Your role can save drafts but not send campaigns."
              }
              onClick={launch}
            >
              {form.trigger ? "Save automation" : "Launch campaign"}
            </Button>
          </>
        }
      >
        <div className="form-compact space-y-space-2">
          <Section n={1} title="Campaign Details">
            <div className="grid gap-space-2 md:grid-cols-2">
              <Field label="Campaign name" htmlFor="k_name" required>
                <Input
                  id="k_name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field label="Objective" htmlFor="k_objective" required>
                <Select
                  id="k_objective"
                  value={form.objective}
                  onValueChange={(v) =>
                    setForm({ ...form, objective: v as CampaignObjective })
                  }
                >
                  {OBJECTIVES.map(([key, label]) => (
                    <option key={key} value={key}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Description (optional)" htmlFor="k_desc">
              <textarea
                id="k_desc"
                rows={2}
                maxLength={500}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                className="w-full resize-y rounded-md border border-line bg-card px-space-3 py-2 text-[13px] leading-5 text-ink-900 shadow-[var(--shadow-sm)] focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-100"
              />
            </Field>
          </Section>

          <Section n={2} title="Campaign Type">
            <div className="grid grid-cols-2 gap-space-2 md:grid-cols-5">
              {TYPES.map((t) => (
                <OptionCard
                  key={t.key}
                  tile
                  selected={form.type === t.key}
                  onSelect={() => setForm({ ...form, type: t.key })}
                  title={t.label}
                  hint={t.hint}
                  icon={<HugeiconsIcon icon={t.icon} size={24} />}
                />
              ))}
            </div>
          </Section>

          <Section n={3} title="Audience">
            <>
              <div className="grid gap-space-2 md:grid-cols-3">
                {!form.individuals && (
                  <Field label="Membership" htmlFor="k_seg">
                    <MultiSelect
                      id="k_seg"
                      placeholder="Everyone"
                      options={SEGMENT_ORDER.map((seg: Segment) => ({
                        value: seg,
                        label: SEGMENT_META[seg].label,
                      }))}
                      value={form.segments}
                      onValueChange={(v) => setForm({ ...form, segments: v })}
                    />
                  </Field>
                )}
                {!form.individuals && (
                  <Field label="Saved segment" htmlFor="k_saved">
                    <Select
                      id="k_saved"
                      value={form.segmentId}
                      onValueChange={(v) => setForm({ ...form, segmentId: v })}
                    >
                      <option value="">None</option>
                      {(savedSegments.data ?? [])
                        .filter(
                          (s) =>
                            (s.status === "active" && s.marketing) ||
                            s.id === form.segmentId,
                        )
                        .map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name} ({s.member_count.toLocaleString("en-IN")})
                          </option>
                        ))}
                    </Select>
                    <Link
                      href="/portal/customers/segments"
                      className="mt-space-1 inline-block text-[12.5px] font-semibold text-brand-700"
                    >
                      + New segment
                    </Link>
                  </Field>
                )}
                {!form.individuals && (
                  <Field label="Customer tag" htmlFor="k_tag">
                    <Select
                      id="k_tag"
                      value={form.tag}
                      onValueChange={(v) => setForm({ ...form, tag: v })}
                    >
                      <option value="">Any</option>
                      {(tags.data ?? []).map((t) => (
                        <option key={t.tag} value={t.tag}>
                          {t.tag}
                        </option>
                      ))}
                    </Select>
                    <Link
                      href="/portal/customers/tags"
                      className="mt-space-1 inline-block text-[12.5px] font-semibold text-brand-700"
                    >
                      + Add new tag
                    </Link>
                  </Field>
                )}
                <div>
                  <Field label="Customer type" htmlFor="k_type">
                    <Select
                      id="k_type"
                      value={
                        form.individuals ? "individuals" : form.customerType
                      }
                      onValueChange={(v) =>
                        v === "individuals"
                          ? setForm({ ...form, individuals: true })
                          : setForm({
                              ...form,
                              individuals: false,
                              customerType: v,
                            })
                      }
                    >
                      <option value="">All customers</option>
                      <option value="individuals">Individuals</option>
                      {/* a campaign saved with an old customer type keeps it until the type is changed */}
                      {form.customerType === "business" && (
                        <option value="business">Business accounts</option>
                      )}
                      {form.customerType === "individual" && (
                        <option value="individual">
                          Individuals (non-business)
                        </option>
                      )}
                    </Select>
                  </Field>
                  {!form.individuals && (
                    <label className="flex items-center gap-space-2 text-[13px]">
                      <input
                        type="checkbox"
                        checked={form.onlyNew}
                        onChange={(e) =>
                          setForm({ ...form, onlyNew: e.target.checked })
                        }
                      />
                      Only new customers
                    </label>
                  )}
                </div>
                {form.individuals && (
                  <Field
                    label="Customers"
                    htmlFor="k_customers"
                    className="md:col-span-2"
                    hint="The campaign goes only to the customers picked here. Membership, tags and the filters don't apply."
                  >
                    <CustomerMultiSelect
                      id="k_customers"
                      value={form.customers}
                      onChange={(customers) => setForm({ ...form, customers })}
                    />
                  </Field>
                )}
              </div>
              {!form.individuals && (
                <>
                  <p className="mt-space-2 mb-space-1 text-[13px] font-semibold text-ink-900">
                    Additional filters{" "}
                    <span className="font-normal text-ink-600">(optional)</span>
                  </p>
                  <div className="grid gap-space-2 md:grid-cols-4">
                    <Field label="City / Location" htmlFor="k_city">
                      <Select
                        id="k_city"
                        value={form.city}
                        onValueChange={(v) => setForm({ ...form, city: v })}
                      >
                        <option value="">All locations</option>
                        {(options.data?.cities ?? []).map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Purchase behaviour" htmlFor="k_purchase">
                      <Select
                        id="k_purchase"
                        value={form.purchase}
                        onValueChange={(v) => setForm({ ...form, purchase: v })}
                      >
                        <option value="">Any</option>
                        <option value="bought">Has bought before</option>
                        <option value="never">Never bought</option>
                        <option value="repeat">
                          Repeat buyers (2+ orders)
                        </option>
                        <option value="recent">Ordered in last 90 days</option>
                      </Select>
                    </Field>
                    <Field label="Gender" htmlFor="k_gender">
                      <Select
                        id="k_gender"
                        value={form.gender}
                        onValueChange={(v) => setForm({ ...form, gender: v })}
                      >
                        <option value="">All</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </Select>
                    </Field>
                    <Field label="Customer since" htmlFor="k_since">
                      <Select
                        id="k_since"
                        value={form.since}
                        onValueChange={(v) => setForm({ ...form, since: v })}
                      >
                        <option value="">Anytime</option>
                        <option value="30d">Last 30 days</option>
                        <option value="90d">Last 90 days</option>
                        <option value="1y">Last year</option>
                      </Select>
                    </Field>
                  </div>
                </>
              )}
            </>
            <div className="mt-space-1 flex items-center gap-space-2 rounded-md bg-brand-50 px-space-3 py-space-2 text-[13px] text-ink-900">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-800 text-white">
                <HugeiconsIcon icon={UserIcon} size={14} />
              </span>
              <span>
                <b>
                  Estimated audience:{" "}
                  {estimate ? estimate.total.toLocaleString("en-IN") : "…"}{" "}
                  customers
                </b>{" "}
                (based on current filters)
                {estimate && (
                  <span className="text-ink-600">
                    {" "}
                    · {estimate.reachable.toLocaleString("en-IN")} reachable on{" "}
                    {CHANNEL_LABEL[primary]}
                  </span>
                )}
              </span>
            </div>
          </Section>

          <Section n={4} title="Offer / Discount">
            <div className="grid gap-space-2 md:grid-cols-2">
              <OptionCard
                selected={form.discountMode === "existing"}
                onSelect={() => setForm({ ...form, discountMode: "existing" })}
                title="Use existing discount"
                hint="Select a discount from available offers"
              />
              <OptionCard
                selected={form.discountMode === "new"}
                onSelect={() => setForm({ ...form, discountMode: "new" })}
                title="Create a new discount"
                hint="Create a new discount for this campaign"
              />
            </div>
            {form.discountMode === "existing" ? (
              <>
                <div className="mt-space-2 flex items-end gap-space-2">
                  <div className="min-w-0 flex-1">
                    <Field
                      label="Select discount"
                      htmlFor="k_disc"
                      required={discountRequired}
                      className="mb-0"
                    >
                      <Select
                        id="k_disc"
                        value={form.discountId}
                        onValueChange={(v) =>
                          setForm({ ...form, discountId: v })
                        }
                      >
                        <option value="">
                          {discountRequired
                            ? "Choose a discount"
                            : "No discount"}
                        </option>
                        {withCode.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name} ({d.code}) - {discountOffer(d)}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  </div>
                  <Link
                    href="/portal/discounts"
                    target="_blank"
                    className="inline-flex h-9 shrink-0 items-center rounded-md border border-line bg-card px-space-4 text-[13px] font-semibold text-ink-900 hover:bg-ink-50"
                  >
                    View details
                  </Link>
                </div>
                {picked && (
                  <div className="mt-space-2 flex items-start gap-space-3 rounded-md border border-brand-200 bg-brand-50 p-space-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-800 text-white">
                      <HugeiconsIcon icon={Tag01Icon} size={18} />
                    </span>
                    <div className="min-w-0 text-[13px] text-ink-600">
                      <p className="text-[14px] font-bold text-ink-900">
                        Discount summary
                      </p>
                      <p>{discountSummary(picked)}</p>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="mt-space-2 grid gap-space-2 md:grid-cols-5">
                <Field
                  label="Discount name"
                  htmlFor="k_nd_name"
                  className="md:col-span-2"
                >
                  <Input
                    id="k_nd_name"
                    placeholder={form.name || "Defaults to the campaign name"}
                    value={form.newName}
                    onChange={(e) =>
                      setForm({ ...form, newName: e.target.value })
                    }
                  />
                </Field>
                <Field
                  label="Coupon code"
                  htmlFor="k_nd_code"
                  className="md:col-span-2"
                >
                  <div className="flex gap-space-2">
                    <Input
                      id="k_nd_code"
                      className="uppercase"
                      value={form.newCode}
                      onChange={(e) =>
                        setForm({ ...form, newCode: e.target.value })
                      }
                    />
                    <Button
                      variant="ghost"
                      type="button"
                      className="shrink-0 border border-line"
                      onClick={() =>
                        setForm({ ...form, newCode: generateCode() })
                      }
                    >
                      Generate
                    </Button>
                  </div>
                </Field>
                <Field label="Type" htmlFor="k_nd_kind">
                  <Select
                    id="k_nd_kind"
                    value={form.newKind}
                    onValueChange={(v) =>
                      setForm({ ...form, newKind: v as "percent" | "flat" })
                    }
                  >
                    <option value="percent">Percentage off</option>
                    <option value="flat">Flat amount off</option>
                  </Select>
                </Field>
                <Field
                  label={
                    form.newKind === "percent" ? "Percentage (%)" : "Amount (₹)"
                  }
                  htmlFor="k_nd_value"
                  required
                >
                  <Input
                    id="k_nd_value"
                    inputMode="decimal"
                    value={form.newValue}
                    onChange={(e) =>
                      setForm({ ...form, newValue: e.target.value })
                    }
                  />
                </Field>
                <Field label="Minimum order (₹)" htmlFor="k_nd_min">
                  <Input
                    id="k_nd_min"
                    inputMode="decimal"
                    value={form.newMinOrder}
                    onChange={(e) =>
                      setForm({ ...form, newMinOrder: e.target.value })
                    }
                  />
                </Field>
                <p className="text-[12px] text-ink-600 md:col-span-3 md:self-end md:pb-space-2">
                  Valid for the campaign&apos;s schedule below. Fine-tune it
                  later on the Discounts page.
                </p>
              </div>
            )}
          </Section>

          <Section n={5} title="Channels & Message">
            <div className="flex flex-wrap items-center justify-between gap-x-space-4 gap-y-space-2 rounded-md border border-line px-space-3 py-space-2">
              {CHANNELS.map((c) => (
                <label
                  key={c.key}
                  className="flex items-center gap-space-2 text-[13px]"
                >
                  <input
                    type="checkbox"
                    checked={form.channels.includes(c.key)}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        channels: e.target.checked
                          ? [...form.channels, c.key]
                          : form.channels.filter((x) => x !== c.key),
                      })
                    }
                  />
                  <span className="text-ink-900">{c.icon}</span>
                  {c.label}
                </label>
              ))}
            </div>
            <div className="mt-space-2 grid gap-space-3 md:grid-cols-[3fr_2fr]">
              <div>
                <Field label="Message" htmlFor="k_msg" required>
                  <textarea
                    id="k_msg"
                    rows={3}
                    className={TEXTAREA_CLASS}
                    value={form.message}
                    onChange={(e) =>
                      setForm({ ...form, message: e.target.value })
                    }
                  />
                </Field>
                {whatsapp && (
                  <p className="mt-space-1 text-[12.5px] text-ink-600">
                    WhatsApp sends this as a plain message to customers who
                    wrote to you in the last 24 hours (WhatsApp&apos;s rule
                    for messages that are not templates). Others are shown as
                    not delivered.
                  </p>
                )}
                <Button
                  variant="ghost"
                  type="button"
                  className="!h-auto mt-space-1 border border-line"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  Preview
                </Button>
                {showPreview && (
                  <div className="mt-space-2 rounded-md bg-ink-50 px-space-3 py-space-2 text-[13px] text-ink-900">
                    <p className="mb-space-1 font-semibold">
                      Preview message ({CHANNEL_LABEL[primary]})
                    </p>
                    <p className="whitespace-pre-wrap">
                      {text.trim() ? sample(text) : "Nothing to preview yet."}
                    </p>
                  </div>
                )}
              </div>
              <div>
                <p className="mb-space-1 text-[13px] font-semibold text-ink-900">
                  Personalization
                </p>
                <div className="flex flex-wrap gap-space-2">
                  {TOKENS.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => insertToken(t)}
                      className="rounded-md border border-info/30 bg-info-tint px-space-3 py-1 text-[13px] text-info hover:brightness-95"
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <p className="mt-space-2 text-[12px] text-ink-600">
                  Click a tag to add it to the message
                  . Each customer sees
                  their own details.
                </p>
              </div>
            </div>
          </Section>

          {form.trigger ? (
            <Section n={6} title="Launch" aside>
              <div className="flex-1 space-y-space-2">
                <div className="grid gap-space-2 md:grid-cols-2">
                  <Field label="Launch" htmlFor="k_trigger" className="mb-0">
                    <Select
                      id="k_trigger"
                      value={form.trigger}
                      onValueChange={(v) =>
                        setForm({ ...form, trigger: v as Form["trigger"] })
                      }
                    >
                      <option value="birthday">
                        Automatically: a customer&apos;s birthday is coming up
                      </option>
                      <option value="anniversary">
                        Automatically: a customer&apos;s anniversary is coming
                        up
                      </option>
                    </Select>
                  </Field>
                  {(form.trigger === "birthday" ||
                    form.trigger === "anniversary") && (
                    <Field
                      label="Days before"
                      htmlFor="k_days_before"
                      className="mb-0"
                      hint="0 = on the day itself"
                    >
                      <Input
                        id="k_days_before"
                        inputMode="numeric"
                        value={form.daysBefore}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            daysBefore: e.target.value.replace(/\D/g, ""),
                          })
                        }
                      />
                    </Field>
                  )}
                  {(form.trigger === "birthday" ||
                    form.trigger === "anniversary") && (
                    <>
                      <Field
                        label="Send"
                        htmlFor="k_sends"
                        className="mb-0"
                        hint="Repeat the message before the day."
                      >
                        <Select
                          id="k_sends"
                          value={form.sends}
                          onValueChange={(v) => setForm({ ...form, sends: v })}
                        >
                          <option value="1">Once</option>
                          <option value="2">2 times</option>
                          <option value="3">3 times</option>
                        </Select>
                      </Field>
                      {form.sends !== "1" && (
                        <Field
                          label="Days between sends"
                          htmlFor="k_interval"
                          className="mb-0"
                        >
                          <Input
                            id="k_interval"
                            inputMode="numeric"
                            value={form.intervalDays}
                            onChange={(e) =>
                              setForm({
                                ...form,
                                intervalDays: e.target.value.replace(/\D/g, ""),
                              })
                            }
                          />
                        </Field>
                      )}
                    </>
                  )}
                  {form.trigger === "anniversary" && (
                    <Field
                      label="Which anniversary"
                      htmlFor="k_anniv_label"
                      className="mb-0 md:col-span-2"
                      hint="The kinds your team has added on customer profiles."
                    >
                      <Select
                        id="k_anniv_label"
                        value={form.anniversaryLabel}
                        onValueChange={(v) =>
                          setForm({ ...form, anniversaryLabel: v })
                        }
                      >
                        <option value="">Any anniversary</option>
                        {(options.data?.anniversary_labels ?? []).map((l) => (
                          <option key={l} value={l}>
                            {l}
                          </option>
                        ))}
                      </Select>
                    </Field>
                  )}
                </div>
                <p className="text-[12.5px] text-ink-600">
                  This campaign launches by itself:{" "}
                  {triggerLabel({
                    type: form.trigger,
                    days_before: Number(form.daysBefore),
                    ...(form.trigger !== "new_arrival" && form.sends !== "1"
                      ? {
                          sends: Number(form.sends),
                          interval_days: Number(form.intervalDays),
                        }
                      : {}),
                    label: form.anniversaryLabel || null,
                  }).toLowerCase()}
                  . Each customer gets it{" "}
                  {form.trigger !== "new_arrival" && form.sends !== "1"
                    ? "on each of those dates"
                    : "once"}{" "}
                  for each occasion, and only if they are in the audience above.
                  You can pause it any time.
                </p>
              </div>
            </Section>
          ) : (
            <Section n={6} title="Schedule" aside>
              <div className="grid flex-1 gap-space-2 md:grid-cols-2">
                <DateTimeField
                  id="k_start"
                  label="Start date & time"
                  value={form.startsAt}
                  onChange={(v) => setForm({ ...form, startsAt: v })}
                  defaultTime="10:00"
                />
                <DateTimeField
                  id="k_end"
                  label="End date & time"
                  value={form.endsAt}
                  onChange={(v) => setForm({ ...form, endsAt: v })}
                  defaultTime="23:59"
                />
              </div>
            </Section>
          )}

          <Section n={7} title="Review & Launch" aside>
            <div className="flex flex-1 items-start gap-space-3 rounded-md border border-brand-200 bg-brand-50 p-space-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-800 text-white">
                <HugeiconsIcon icon={Megaphone01Icon} size={18} />
              </span>
              <div className="min-w-0 text-[13px] text-ink-600">
                <p className="text-[14px] font-bold text-ink-900">
                  {form.name.trim() || "Untitled campaign"}
                </p>
                <p>
                  {TYPES.find((t) => t.key === form.type)?.label} • Audience:{" "}
                  {estimate ? estimate.total.toLocaleString("en-IN") : "…"}{" "}
                  customers • Channels:{" "}
                  {form.channels.map((c) => CHANNEL_LABEL[c]).join(", ") ||
                    "none"}
                  {form.discountMode === "existing" && picked
                    ? ` • Discount: ${picked.code} (${discountOffer(picked)})`
                    : form.discountMode === "new"
                      ? " • Discount: new"
                      : ""}
                </p>
                {(form.startsAt || form.endsAt) && (
                  <p>
                    Schedule:{" "}
                    {form.startsAt
                      ? `${shortDate(form.startsAt)}, ${form.startsAt.split("T")[1]}`
                      : "now"}{" "}
                    to{" "}
                    {form.endsAt
                      ? `${shortDate(form.endsAt)}, ${form.endsAt.split("T")[1]}`
                      : "no end"}
                  </p>
                )}
              </div>
            </div>
          </Section>
        </div>
      </Modal>
      <ConfirmDialog
        open={sending !== null}
        title="Send this campaign?"
        message={`“${sending?.name ?? ""}” goes to everyone in its audience now. A campaign can only be sent once.`}
        confirmLabel="Send"
        busy={busy}
        onConfirm={send}
        onCancel={() => setSending(null)}
      />
      <ConfirmDialog
        open={deleting !== null}
        title="Delete this draft?"
        message={`“${deleting?.name ?? ""}” will be removed.`}
        confirmLabel="Delete"
        destructive
        onConfirm={remove}
        onCancel={() => setDeleting(null)}
      />
      <Modal
        open={detailing !== null}
        onClose={() => setDetailing(null)}
        title="Edit campaign"
        description="This campaign has been sent, so its audience, channels and message stay as they went out."
        // a phone gets a slimmer header (the note on one line), tighter body and one row of buttons
        headerClassName="max-md:!p-space-3 max-md:[&_p]:truncate"
        bodyClassName="max-md:!p-space-3"
        footerClassName="max-md:flex-nowrap max-md:!p-space-3 max-md:[&>*]:!h-10 max-md:[&>*]:!w-auto max-md:[&>*]:flex-1 max-md:[&>*]:whitespace-nowrap max-md:[&>*:last-child]:flex-[2]"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDetailing(null)}>
              Cancel
            </Button>
            <Button
              disabled={busy || !details.name.trim()}
              onClick={saveDetails}
            >
              Save changes
            </Button>
          </>
        }
      >
        <div className="form-compact space-y-space-2 max-md:space-y-0 max-md:[&>*]:mb-[6px] max-md:[&_.mb-space-4]:!mb-[6px]">
          <div className="grid gap-space-2 md:grid-cols-2">
            <Field label="Campaign name" htmlFor="d_name" required>
              <Input
                id="d_name"
                value={details.name}
                onChange={(e) =>
                  setDetails({ ...details, name: e.target.value })
                }
              />
            </Field>
            <Field label="Objective" htmlFor="d_objective" required>
              <Select
                id="d_objective"
                value={details.objective}
                onValueChange={(v) =>
                  setDetails({ ...details, objective: v as CampaignObjective })
                }
              >
                {OBJECTIVES.map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <Field label="Description" htmlFor="d_desc">
            <textarea
              id="d_desc"
              rows={2}
              className={`${TEXTAREA_CLASS} max-md:!min-h-0 max-md:!h-14`}
              value={details.description}
              onChange={(e) =>
                setDetails({ ...details, description: e.target.value })
              }
            />
          </Field>
          <Field label="Offer / discount" htmlFor="d_disc">
            <Select
              id="d_disc"
              value={details.discountId}
              onValueChange={(v) => setDetails({ ...details, discountId: v })}
            >
              <option value="">No discount</option>
              {withCode.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code}) - {discountOffer(d)}
                </option>
              ))}
            </Select>
          </Field>
          <div className="grid gap-space-2 md:grid-cols-2">
            <DateTimeField
              id="d_start"
              label="Start date & time"
              value={details.startsAt}
              onChange={(v) => setDetails({ ...details, startsAt: v })}
              defaultTime="10:00"
            />
            <DateTimeField
              id="d_end"
              label="End date & time"
              value={details.endsAt}
              onChange={(v) => setDetails({ ...details, endsAt: v })}
              defaultTime="23:59"
            />
          </div>
        </div>
      </Modal>
      <Modal
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title={viewing?.name ?? ""}
        description="Every message in this campaign"
        footer={
          <Button variant="ghost" onClick={() => setViewing(null)}>
            Close
          </Button>
        }
      >
        <div className="mb-space-4 grid grid-cols-2 gap-space-2 sm:grid-cols-4">
          {(
            [
              ["Messages", logCounts.total, "text-ink-900"],
              ["Delivered", logCounts.delivered, "text-ink-900"],
              ["Read", logCounts.read, "text-brand-700"],
              [
                "Failed",
                logCounts.failed,
                logCounts.failed ? "text-red-600" : "text-ink-900",
              ],
            ] as const
          ).map(([label, value, tone]) => (
            <div
              key={label}
              className="rounded-xl border border-line bg-paper px-space-3 py-space-2"
            >
              <p className="text-[12px] font-medium text-ink-600">{label}</p>
              <p className={cn("text-[22px] leading-tight font-bold", tone)}>
                {value.toLocaleString("en-IN")}
              </p>
            </div>
          ))}
        </div>
        <MessageList
          cards
          messages={log.data ?? []}
          empty={log.loading ? "Loading…" : "No messages."}
        />
      </Modal>
    </div>
  );
}
