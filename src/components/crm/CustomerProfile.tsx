"use client";

import {
  Cancel01Icon,
  Call02Icon,
  Add01Icon,
  Delete02Icon,
  BirthdayCakeIcon,
  Calendar03Icon,
  Location01Icon,
  Mail01Icon,
  Message01Icon,
  Note01Icon,
  StarIcon,
  Wallet01Icon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ChannelBadge,
  OrderStatusBadge,
  PaymentStatusBadge,
} from "@/components/erp/StatusBadges";
import {
  Avatar,
  ComposeModal,
  MessageList,
  SegmentBadge,
} from "@/components/crm/shared";
import { Badge } from "@/components/erp-ui/Badge";
import { Button } from "@/components/erp-ui/Button";
import { Card } from "@/components/erp-ui/Card";
import { ConfirmDialog } from "@/components/erp-ui/ConfirmDialog";
import { Field } from "@/components/erp-ui/Field";
import { Input } from "@/components/erp-ui/Input";
import { Modal } from "@/components/erp-ui/Modal";
import { Select } from "@/components/erp-ui/Select";
import { SkeletonLines } from "@/components/erp-ui/Skeleton";
import { Tabs } from "@/components/erp-ui/Tabs";
import {
  TEXTAREA_CLASS,
  formatDate,
  type CrmMessage,
  type CrmNote,
  type CrmProfile,
  type CrmSettings,
} from "@/lib/erp/crm";
import { BENEFIT_TIERS, TIER_LABEL, type BenefitTier } from "@/lib/erp/membership";
import {
  erp,
  formatDateTime,
  formatMoney,
  useErpQuery,
  type Order,
  type StoreCredit,
} from "@/lib/erp/erp";
import { toast } from "@/lib/toast";
import { formatPhone } from "@/lib/erp/phone";

type Tab = "overview" | "orders" | "communication" | "notes";
const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "orders", label: "Purchase History" },
  { key: "communication", label: "Communication" },
  { key: "notes", label: "Notes" },
];

function Fact({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-space-2 text-[13.5px] text-ink-900">
      <span className="mt-0.5 text-ink-400">{icon}</span>
      <span className="min-w-0 break-words">{children}</span>
    </li>
  );
}

function Mini({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-md border border-line p-space-2">
      <span className="text-brand-600">{icon}</span>
      <p className="mt-1 text-[16px] font-bold text-ink-900">{value}</p>
      <p className="text-[11px] text-ink-600">{label}</p>
    </div>
  );
}

/** One customer, CRM style: contact facts, loyalty, tags, purchase history, messages and notes. Used in the side panel and the full page. */
export function CustomerProfile({
  customerId,
  currency,
  canEdit,
  canAdjustLoyalty = canEdit,
  onChanged,
  showOpenLink,
}: {
  customerId: string;
  currency: string;
  canEdit: boolean;
  canAdjustLoyalty?: boolean;
  onChanged?: () => void;
  showOpenLink?: boolean;
}) {
  const router = useRouter();
  const profile = useErpQuery<CrmProfile>(
    `/api/v1/crm/customers/${customerId}`,
  );
  const credit = useErpQuery<StoreCredit>(
    `/api/v1/customers/${customerId}/store-credit`,
  );
  const [tab, setTab] = useState<Tab>("overview");
  const orders = useErpQuery<Order[]>(
    tab === "orders"
      ? `/api/v1/orders?customer_id=${customerId}&limit=100`
      : null,
  );
  const messages = useErpQuery<CrmMessage[]>(
    tab === "communication"
      ? `/api/v1/crm/messages?customer_id=${customerId}`
      : null,
  );
  const notes = useErpQuery<CrmNote[]>(
    tab === "notes" ? `/api/v1/crm/customers/${customerId}/notes` : null,
  );
  const [composing, setComposing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [addingAnniv, setAddingAnniv] = useState(false);
  const [anniv, setAnniv] = useState({ day: "", label: "" });
  const [annivBusy, setAnnivBusy] = useState(false);
  const [adjusting, setAdjusting] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tagText, setTagText] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    gstin: "",
    notes: "",
    status: "active",
    birthday: "",
    gender: "",
    preferences: "",
    optIn: false,
  });
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [tagError, setTagError] = useState<string | null>(null);
  const [tier, setTier] = useState<"" | BenefitTier>("");
  const known = useErpQuery<{ tag: string; customers: number }[]>(
    editing ? "/api/v1/crm/tags" : null,
  );
  const plans = useErpQuery<{ settings: CrmSettings }>(
    editing ? "/api/v1/crm/segments" : null,
  );
  const [adjust, setAdjust] = useState({ delta: "", reason: "" });
  const [noteBody, setNoteBody] = useState("");
  const [followUp, setFollowUp] = useState("");

  const c = profile.data;
  if (profile.error)
    return (
      <p className="text-[13.5px] font-medium text-error">{profile.error}</p>
    );
  if (!c) return <SkeletonLines rows={4} />;

  const changed = () => {
    profile.reload();
    onChanged?.();
  };
  async function saveAnniversary() {
    if (!anniv.day || !anniv.label.trim() || annivBusy) return;
    setAnnivBusy(true);
    const res = await erp(
      `/api/v1/crm/customers/${customerId}/special-days`,
      "POST",
      { label: anniv.label.trim(), day: anniv.day },
    );
    setAnnivBusy(false);
    if (res.error)
      return toast.error("Couldn't save the anniversary", res.error);
    setAddingAnniv(false);
    setAnniv({ day: "", label: "" });
    changed();
  }
  async function removeAnniversary(id: string) {
    const res = await erp(
      `/api/v1/crm/customers/${customerId}/special-days/${id}`,
      "DELETE",
    );
    if (res.error)
      return toast.error("Couldn't remove the anniversary", res.error);
    changed();
  }
  const defaultAddress =
    c.addresses.find((a) => a.is_default) ?? c.addresses[0];

  function openEdit() {
    if (!c) return;
    setForm({
      name: c.name,
      email: c.email ?? "",
      gstin: c.gstin ?? "",
      notes: c.notes ?? "",
      status: c.status,
      birthday: c.birthday ?? "",
      gender: c.gender ?? "",
      preferences: c.preferences ?? "",
      optIn: c.whatsapp_opt_in,
    });
    setTags(c.tags);
    setTagDraft("");
    setTagError(null);
    setTier(
      c.segment === "not_member"
        ? ""
        : c.segment === "inactive"
          ? "regular"
          : (c.segment as BenefitTier),
    );
    setEditing(true);
  }

  /** Block (or unblock) the customer: a blocked customer can't sign in to the website, order there or on WhatsApp, or get messages. */
  async function toggleBlock() {
    if (!c) return;
    setBusy(true);
    const blocked = c.status === "blocked";
    const res = await erp(`/api/v1/customers/${customerId}`, "PATCH", {
      status: blocked ? "active" : "blocked",
    });
    setBusy(false);
    setBlocking(false);
    if (res.error)
      return toast.error(
        blocked
          ? "Couldn't unblock the customer"
          : "Couldn't block the customer",
        res.error,
      );
    toast.success(blocked ? "Customer unblocked" : "Customer blocked");
    changed();
  }

  /** Adds the typed tag to the list (spaces collapsed, case kept, tags told apart without regard to case); false when it was refused. */
  function commitTag(): boolean {
    const tag = tagDraft.split(/\s+/).filter(Boolean).join(" ");
    if (!tag) return true;
    if (tag.length > 40) {
      setTagError("A tag can be at most 40 characters.");
      return false;
    }
    if (tags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
      setTagError("That tag is already added.");
      return false;
    }
    if (tags.length >= 20) {
      setTagError("A customer can have at most 20 tags.");
      return false;
    }
    setTags([...tags, tag]);
    setTagDraft("");
    setTagError(null);
    return true;
  }

  const minPoints = (t: BenefitTier) =>
    t === "regular" ? 0 : (plans.data?.settings[`${t}_min_points`] ?? null);

  async function saveEdit() {
    if (!c) return;
    if (!commitTag()) return;
    setBusy(true);
    const a = await erp(`/api/v1/customers/${customerId}`, "PATCH", {
      name: form.name.trim(),
      email: form.email.trim(),
      gstin: form.gstin.trim(),
      notes: form.notes.trim(),
      status: form.status,
    });
    const b = a.error
      ? a
      : await erp(`/api/v1/crm/customers/${customerId}/profile`, "PATCH", {
          birthday: form.birthday || null,
          gender: form.gender || null,
          preferences: form.preferences.trim() || null,
          whatsapp_opt_in: form.optIn,
        });
    const missed: string[] = [];
    if (!b.error) {
      const finalTags = tagDraft.trim()
        ? [...tags, tagDraft.split(/\s+/).filter(Boolean).join(" ")]
        : tags;
      const lower = (l: string[]) => l.map((t) => t.toLowerCase());
      const add = finalTags.filter(
        (t) => !lower(c.tags).includes(t.toLowerCase()),
      );
      const remove = c.tags.filter(
        (t) => !lower(finalTags).includes(t.toLowerCase()),
      );
      if (add.length || remove.length) {
        const t = await erp("/api/v1/crm/tags", "POST", {
          customer_ids: [customerId],
          add,
          remove,
        });
        if (t.error) missed.push(`tags (${t.error})`);
      }
      // A member's tier follows their loyalty points: enrol if needed, then add the points the chosen tier starts at.
      if (tier !== "" && (c.segment === "not_member" || tier !== c.segment)) {
        const target = minPoints(tier);
        if (target === null) missed.push("membership (tier points not loaded)");
        else {
          let ok = true;
          if (c.segment === "not_member") {
            const m = await erp("/api/v1/crm/membership/members", "POST", {
              customer_id: customerId,
              source: "in_store",
            });
            if (m.error) {
              missed.push(`membership (${m.error})`);
              ok = false;
            }
          }
          const delta = target - c.loyalty.points;
          if (ok && delta > 0) {
            const bonus = await erp(
              `/api/v1/crm/customers/${customerId}/loyalty`,
              "POST",
              {
                delta,
                reason: `Tier set to ${TIER_LABEL[tier]} when the customer was edited`,
              },
            );
            if (bonus.error)
              missed.push(`${TIER_LABEL[tier]} tier (${bonus.error})`);
          }
        }
      }
    }
    setBusy(false);
    if (b.error) return toast.error("Couldn't save the customer", b.error);
    if (missed.length)
      toast.error(
        "Saved, but not everything",
        `Couldn't update ${missed.join("; ")}.`,
      );
    else toast.success("Customer updated");
    setEditing(false);
    changed();
  }

  async function changeTags(add: string[], remove: string[]) {
    const res = await erp("/api/v1/crm/tags", "POST", {
      customer_ids: [customerId],
      add,
      remove,
    });
    if (res.error) return toast.error("Couldn't change tags", res.error);
    setTagText("");
    changed();
  }

  async function saveAdjust() {
    const delta = Number.parseInt(adjust.delta, 10);
    if (!Number.isFinite(delta) || delta === 0)
      return toast.error(
        "Enter the points",
        "Use a positive number to add or a negative one to take away.",
      );
    setBusy(true);
    const res = await erp(
      `/api/v1/crm/customers/${customerId}/loyalty`,
      "POST",
      { delta, reason: adjust.reason.trim() },
    );
    setBusy(false);
    if (res.error) return toast.error("Couldn't adjust points", res.error);
    toast.success("Loyalty points updated");
    setAdjusting(false);
    setAdjust({ delta: "", reason: "" });
    changed();
  }

  async function addNote() {
    setBusy(true);
    const res = await erp(`/api/v1/crm/customers/${customerId}/notes`, "POST", {
      body: noteBody.trim(),
      follow_up_at: followUp ? new Date(followUp).toISOString() : null,
    });
    setBusy(false);
    if (res.error) return toast.error("Couldn't add the note", res.error);
    setNoteBody("");
    setFollowUp("");
    notes.reload();
    onChanged?.();
  }

  async function noteDone(n: CrmNote) {
    const res = await erp(`/api/v1/crm/notes/${n.id}`, "PATCH", {
      done: !n.done_at,
    });
    if (res.error) return toast.error("Couldn't update the note", res.error);
    notes.reload();
    onChanged?.();
  }

  async function removeNote(n: CrmNote) {
    const res = await erp(`/api/v1/crm/notes/${n.id}`, "DELETE");
    if (res.error) return toast.error("Couldn't delete the note", res.error);
    notes.reload();
    onChanged?.();
  }

  return (
    <div>
      <div className="mb-space-3 flex flex-wrap items-start gap-space-3">
        <Avatar name={c.name} size={48} />
        <div className="min-w-0 flex-1">
          <h2 className="flex flex-wrap items-center gap-space-2 text-[18px] font-bold text-ink-900">
            {c.name || "Unnamed customer"}
            <SegmentBadge segment={c.segment} />
            {c.status === "blocked" && <Badge tone="error">Blocked</Badge>}
          </h2>
          <p className="text-[12px] text-ink-400">
            Customer ID: {c.customer_code ?? "—"}
          </p>
        </div>
        <div className="mobile-page-actions flex gap-space-2 max-md:!flex-nowrap max-md:[&>*]:!w-auto max-md:[&>*]:!flex-1 max-md:[&>*]:!px-space-2">
          {showOpenLink && (
            <Button
              variant="ghost"
              onClick={() => router.push(`/portal/customers/${c.id}`)}
            >
              Open
            </Button>
          )}
          {canEdit && (
            <>
              <Button variant="ghost" onClick={() => setComposing(true)}>
                <HugeiconsIcon icon={Message01Icon} size={15} /> Message
              </Button>
              <Button variant="ghost" onClick={openEdit}>
                Edit
              </Button>
              <Button variant="ghost" onClick={() => setBlocking(true)}>
                {c.status === "blocked" ? "Unblock" : "Block"}
              </Button>
            </>
          )}
        </div>
      </div>
      {c.status === "blocked" && (
        <p className="mb-space-3 rounded-md bg-error-tint px-space-3 py-space-2 text-[13px] text-ink-900">
          This customer is blocked: they can&apos;t sign in to the website,
          place orders there or on WhatsApp, or receive messages and campaigns.
        </p>
      )}
      <ConfirmDialog
        open={blocking}
        title={
          c.status === "blocked"
            ? "Unblock this customer?"
            : "Block this customer?"
        }
        message={
          c.status === "blocked"
            ? `${c.name || "This customer"} will be able to sign in, order on the website and WhatsApp, and get messages again.`
            : `${c.name || "This customer"} won't be able to sign in to the website, place orders there or on WhatsApp, or receive messages and campaigns. Their order history stays.`
        }
        confirmLabel={c.status === "blocked" ? "Unblock" : "Block"}
        destructive={c.status !== "blocked"}
        busy={busy}
        onConfirm={toggleBlock}
        onCancel={() => setBlocking(false)}
      />

      <Tabs tabs={TABS} value={tab} onChange={setTab} className="!mb-space-3" />

      {tab === "overview" && (
        <div className="space-y-space-4">
          <ul className="space-y-space-2">
            <Fact icon={<HugeiconsIcon icon={Call02Icon} size={16} />}>
              {formatPhone(c.phone) || (
                <span className="text-ink-400">No phone</span>
              )}
            </Fact>
            <Fact icon={<HugeiconsIcon icon={Mail01Icon} size={16} />}>
              {c.email ?? <span className="text-ink-400">No email</span>}
            </Fact>
            <Fact icon={<HugeiconsIcon icon={Location01Icon} size={16} />}>
              {defaultAddress ? (
                [
                  defaultAddress.line1,
                  defaultAddress.line2,
                  defaultAddress.city,
                  defaultAddress.state,
                  defaultAddress.pincode,
                ]
                  .filter(Boolean)
                  .join(", ")
              ) : (
                <span className="text-ink-400">No saved address</span>
              )}
            </Fact>
            <Fact icon={<HugeiconsIcon icon={BirthdayCakeIcon} size={16} />}>
              {c.birthday ? (
                <>Date of birth {formatDate(c.birthday)}</>
              ) : (
                <span className="text-ink-400">No date of birth</span>
              )}
            </Fact>
            <Fact icon={<HugeiconsIcon icon={Calendar03Icon} size={16} />}>
              {c.special_days.length > 0 ? (
                c.special_days
                  .map((d) => `${d.label} ${formatDate(d.day)}`)
                  .join(" · ")
              ) : (
                <span className="text-ink-400">No anniversaries</span>
              )}
            </Fact>
            <Fact icon={<HugeiconsIcon icon={Calendar03Icon} size={16} />}>
              Joined {formatDate(c.created_at)} · Last purchase{" "}
              {formatDate(c.last_order_at)}
            </Fact>
          </ul>

          <div className="grid grid-cols-2 gap-space-2 md:grid-cols-4">
            <Mini
              icon={<HugeiconsIcon icon={StarIcon} size={18} />}
              label="Loyalty points"
              value={c.loyalty.points.toLocaleString("en-IN")}
            />
            <Mini
              icon={<HugeiconsIcon icon={Wallet01Icon} size={18} />}
              label="Credit balance"
              value={formatMoney(credit.data?.balance_minor ?? 0, currency)}
            />
            <Mini
              icon={<HugeiconsIcon icon={Note01Icon} size={18} />}
              label="Total orders"
              value={c.total_orders}
            />
            <Mini
              icon={<HugeiconsIcon icon={Wallet01Icon} size={18} />}
              label="Total spent"
              value={formatMoney(c.total_spent_minor, currency)}
            />
          </div>
          {canAdjustLoyalty && c.membership_eligible && (
            <Button
              className="mobile-page-action"
              variant="ghost"
              onClick={() => setAdjusting(true)}
            >
              Adjust loyalty points
            </Button>
          )}
          {!c.membership_eligible && (
            <p className="text-[12px] text-ink-600">
              The customer must become a member (Customers &gt; Membership) before
              earning or redeeming loyalty points.
            </p>
          )}

          <div>
            <h3 className="mb-space-2 text-[13px] font-bold text-ink-900">
              Customer tags
            </h3>
            <div className="flex flex-wrap items-center gap-space-2">
              {c.tags.length === 0 && (
                <span className="text-[13px] text-ink-400">No tags yet.</span>
              )}
              {c.tags.map((t) => (
                <Badge key={t} tone="clay" className="normal-case">
                  {t}
                  {canEdit && (
                    <button
                      type="button"
                      aria-label={`Remove ${t}`}
                      className="ml-1 text-ink-600 hover:text-error"
                      onClick={() => changeTags([], [t])}
                    >
                      ×
                    </button>
                  )}
                </Badge>
              ))}
              {canEdit && (
                <form
                  className="flex items-center gap-space-1"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (tagText.trim()) changeTags([tagText], []);
                  }}
                >
                  <Input
                    value={tagText}
                    onChange={(e) => setTagText(e.target.value)}
                    placeholder="+ Add tag"
                    className="!h-8 w-32 text-[13px]"
                    aria-label="Add tag"
                  />
                </form>
              )}
            </div>
          </div>

          <dl className="grid grid-cols-3 gap-y-space-2 text-[13.5px]">
            <dt className="text-ink-600">Segment</dt>
            <dd className="col-span-2">
              <SegmentBadge segment={c.segment} />
            </dd>
            <dt className="text-ink-600">Date of birth</dt>
            <dd className="col-span-2">
              {c.birthday ? formatDate(c.birthday) : "—"}
            </dd>
            <dt className="text-ink-600">Anniversaries</dt>
            <dd className="col-span-2">
              {c.special_days.length === 0 && !(canEdit && addingAnniv) && "—"}
              {c.special_days.length > 0 && (
                <ul className="mb-space-1 space-y-1">
                  {c.special_days.map((d) => (
                    <li key={d.id} className="flex items-center gap-space-2">
                      <span>
                        {d.label} · {formatDate(d.day)}
                      </span>
                      {canEdit && (
                        <button
                          type="button"
                          aria-label={`Remove ${d.label}`}
                          onClick={() => void removeAnniversary(d.id)}
                          className="flex h-6 w-6 items-center justify-center rounded text-ink-400 hover:bg-black/[0.05] hover:text-ink-700"
                        >
                          <HugeiconsIcon icon={Delete02Icon} size={14} />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {canEdit && addingAnniv && (
                <form
                  className="flex flex-nowrap items-center gap-space-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void saveAnniversary();
                  }}
                >
                  <Input
                    aria-label="Anniversary of"
                    className="min-w-0 flex-1 !h-8 !rounded-md !px-space-2 !text-[13px]"
                    maxLength={60}
                    placeholder="Of what? e.g. Wedding"
                    value={anniv.label}
                    onChange={(e) =>
                      setAnniv({ ...anniv, label: e.target.value })
                    }
                  />
                  <Input
                    type="date"
                    aria-label="Anniversary date"
                    className="!w-36 shrink-0 !h-8 !rounded-md !px-space-2 !text-[13px]"
                    value={anniv.day}
                    onChange={(e) =>
                      setAnniv({ ...anniv, day: e.target.value })
                    }
                  />
                  <Button
                    type="submit"
                    className="shrink-0 !h-8 !px-space-3 !text-[13px]"
                    disabled={!anniv.day || !anniv.label.trim() || annivBusy}
                  >
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="shrink-0 !h-8 !px-space-3 !text-[13px]"
                    onClick={() => setAddingAnniv(false)}
                  >
                    Cancel
                  </Button>
                </form>
              )}
              {canEdit && !addingAnniv && (
                <button
                  type="button"
                  onClick={() => setAddingAnniv(true)}
                  className="flex items-center gap-1 text-[13px] font-semibold text-brand-700 hover:underline"
                >
                  <HugeiconsIcon icon={Add01Icon} size={14} /> Add anniversary
                </button>
              )}
            </dd>
            <dt className="text-ink-600">Gender</dt>
            <dd className="col-span-2 capitalize">{c.gender ?? "—"}</dd>
            <dt className="text-ink-600">Preferences</dt>
            <dd className="col-span-2 whitespace-pre-wrap">
              {c.preferences ?? "—"}
            </dd>
            <dt className="text-ink-600">WhatsApp</dt>
            <dd className="col-span-2">
              {c.whatsapp_opt_in ? (
                <Badge tone="success">Opted in</Badge>
              ) : (
                "Not opted in"
              )}
            </dd>
            <dt className="text-ink-600">Internal note</dt>
            <dd className="col-span-2 whitespace-pre-wrap">{c.notes ?? "—"}</dd>
          </dl>

          {c.addresses.length > 1 && (
            <div>
              <h3 className="mb-space-2 text-[13px] font-bold text-ink-900">
                All addresses
              </h3>
              <div className="grid gap-space-2 md:grid-cols-2">
                {c.addresses.map((a) => (
                  <div
                    key={a.id}
                    className="rounded-md border border-line p-space-2 text-[13px]"
                  >
                    <p className="font-semibold text-ink-900">
                      {a.label ?? "Address"}{" "}
                      {a.is_default && <Badge tone="brand">Default</Badge>}
                    </p>
                    <p className="text-ink-600">
                      {[a.line1, a.line2, a.city, a.state, a.pincode]
                        .filter(Boolean)
                        .join(", ")}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "orders" && (
        <div>
          {orders.loading && <SkeletonLines rows={3} />}
          {!orders.loading && (orders.data ?? []).length === 0 && (
            <p className="text-[13px] text-ink-400">No orders yet.</p>
          )}
          <ul className="divide-y divide-line">
            {(orders.data ?? []).map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  onClick={() => router.push(`/portal/orders/${o.id}`)}
                  className="flex w-full flex-wrap items-center justify-between gap-space-2 py-space-2 text-left text-[13.5px] hover:bg-black/[0.02]"
                >
                  <span className="flex items-center gap-space-2">
                    <span className="font-semibold text-ink-900">
                      {o.order_number}
                    </span>
                    <ChannelBadge channel={o.channel} />
                  </span>
                  <span className="flex flex-wrap items-center gap-space-2">
                    <span className="text-ink-600">
                      {formatDateTime(o.placed_at)}
                    </span>
                    <span className="font-medium">
                      {formatMoney(o.total_minor, o.currency)}
                    </span>
                    <PaymentStatusBadge status={o.payment_status} />
                    <OrderStatusBadge status={o.status} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {tab === "communication" && (
        <div>
          {canEdit && (
            <Button
              className="mobile-page-action mb-space-3"
              onClick={() => setComposing(true)}
            >
              <HugeiconsIcon icon={Message01Icon} size={15} /> New message
            </Button>
          )}
          {messages.loading ? (
            <SkeletonLines rows={3} />
          ) : (
            <MessageList
              messages={messages.data ?? []}
              empty="No messages sent to this customer yet."
            />
          )}
        </div>
      )}

      {tab === "notes" && (
        <div className="space-y-space-3">
          {canEdit && (
            <Card className="space-y-space-2 p-space-3">
              <textarea
                rows={3}
                className={TEXTAREA_CLASS}
                placeholder="Write a note about this customer…"
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                aria-label="Note"
              />
              <div className="flex flex-wrap items-center gap-space-2">
                <label
                  className="text-[12.5px] text-ink-600"
                  htmlFor="followup"
                >
                  Follow up on
                </label>
                <Input
                  id="followup"
                  type="datetime-local"
                  value={followUp}
                  onChange={(e) => setFollowUp(e.target.value)}
                  className="!h-9 w-auto"
                />
                <Button
                  className="mobile-page-action ml-auto"
                  disabled={busy || !noteBody.trim()}
                  onClick={addNote}
                >
                  Add note
                </Button>
              </div>
            </Card>
          )}
          {notes.loading && <SkeletonLines rows={2} />}
          {!notes.loading && (notes.data ?? []).length === 0 && (
            <p className="text-[13px] text-ink-400">No notes yet.</p>
          )}
          <ul className="space-y-space-2">
            {(notes.data ?? []).map((n) => (
              <li
                key={n.id}
                className="rounded-md border border-line p-space-3 text-[13.5px]"
              >
                <p
                  className={
                    n.done_at ? "text-ink-400 line-through" : "text-ink-900"
                  }
                >
                  {n.body}
                </p>
                <p className="mt-1 flex flex-wrap items-center gap-space-2 text-[12px] text-ink-400">
                  {n.author ?? "Staff"} · {formatDateTime(n.created_at)}
                  {n.follow_up_at && (
                    <Badge tone={n.done_at ? "neutral" : "warning"}>
                      Follow up {formatDateTime(n.follow_up_at)}
                    </Badge>
                  )}
                  {canEdit && (
                    <span className="mobile-page-actions ml-auto flex gap-space-3">
                      {n.follow_up_at && (
                        <button
                          type="button"
                          className="font-semibold text-brand-600 hover:underline"
                          onClick={() => noteDone(n)}
                        >
                          {n.done_at ? "Reopen" : "Mark done"}
                        </button>
                      )}
                      <button
                        type="button"
                        className="font-semibold text-error hover:underline"
                        onClick={() => removeNote(n)}
                      >
                        Delete
                      </button>
                    </span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      <ComposeModal
        customer={composing ? c : null}
        onClose={() => setComposing(false)}
        onSent={() => {
          messages.reload();
          onChanged?.();
        }}
      />

      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title="Edit customer"
        description="Change any detail of this customer. The phone number identifies them, so it is shown but can't be changed."
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button disabled={busy || !form.name.trim()} onClick={saveEdit}>
              Save changes
            </Button>
          </>
        }
      >
        <Field label="Name" htmlFor="e_name" required>
          <Input
            id="e_name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </Field>
        <Field label="Phone" htmlFor="e_phone">
          <Input
            id="e_phone"
            value={c.phone ? formatPhone(c.phone) : ""}
            disabled
            readOnly
          />
        </Field>
        <Field label="Email" htmlFor="e_email">
          <Input
            id="e_email"
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
          />
        </Field>
        <div className="grid grid-cols-2 gap-space-3">
          <Field label="Birthday" htmlFor="e_bday">
            <Input
              id="e_bday"
              type="date"
              value={form.birthday}
              onChange={(e) => setForm({ ...form, birthday: e.target.value })}
            />
          </Field>
          <Field label="Gender" htmlFor="e_gender">
            <Select
              id="e_gender"
              value={form.gender}
              onValueChange={(value) => setForm({ ...form, gender: value })}
            >
              <option value="">Not specified</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
            </Select>
          </Field>
        </div>
        <Field label="GSTIN" htmlFor="e_gstin">
          <Input
            id="e_gstin"
            value={form.gstin}
            onChange={(e) => setForm({ ...form, gstin: e.target.value })}
          />
        </Field>
        <Field label="Preferences" htmlFor="e_pref">
          <textarea
            id="e_pref"
            rows={2}
            className={TEXTAREA_CLASS}
            value={form.preferences}
            onChange={(e) => setForm({ ...form, preferences: e.target.value })}
          />
        </Field>
        <Field label="Internal note" htmlFor="e_notes">
          <Input
            id="e_notes"
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />
        </Field>
        <Field
          label="Membership"
          htmlFor="e_tier"
          hint={
            tier !== "" && tier !== c.segment && minPoints(tier)
              ? `Moves them to ${TIER_LABEL[tier]} by adding loyalty points up to ${minPoints(tier)}. The adjustment is recorded. A tier can't be lowered here, because it follows the points earned.`
              : "A member's tier follows their loyalty points. Choosing a higher tier adds the points it needs."
          }
        >
          <Select
            id="e_tier"
            value={tier}
            onValueChange={(v) => setTier(v as "" | BenefitTier)}
          >
            {c.segment === "not_member" && (
              <option value="">Not a member</option>
            )}
            {BENEFIT_TIERS.filter(
              (t) =>
                c.segment === "not_member" ||
                c.segment === "inactive" ||
                c.segment === t ||
                BENEFIT_TIERS.indexOf(t) >
                  BENEFIT_TIERS.indexOf(c.segment as BenefitTier),
            ).map((t) => (
              <option key={t} value={t}>
                {TIER_LABEL[t]}
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Tags"
          htmlFor="e_tag"
          error={tagError ?? undefined}
          hint={tagError ? undefined : "Press Enter or comma after each tag."}
        >
          {tags.length > 0 && (
            <ul
              className="mb-space-2 flex flex-wrap gap-space-1"
              aria-label="Tags"
            >
              {tags.map((t) => (
                <li key={t}>
                  <Badge tone="clay" className="normal-case">
                    {t}
                    <button
                      type="button"
                      aria-label={`Remove tag ${t}`}
                      onClick={() => setTags(tags.filter((x) => x !== t))}
                      className="ml-1 inline-flex text-ink-600 hover:text-error"
                    >
                      <HugeiconsIcon icon={Cancel01Icon} size={12} />
                    </button>
                  </Badge>
                </li>
              ))}
            </ul>
          )}
          <Input
            id="e_tag"
            list="e_tag_suggestions"
            placeholder={tags.length ? "Add another tag" : "e.g. vip, wedding"}
            value={tagDraft}
            onChange={(e) => {
              setTagDraft(e.target.value.replace(/,/g, ""));
              setTagError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === ",") {
                e.preventDefault();
                commitTag();
              } else if (e.key === "Backspace" && !tagDraft && tags.length)
                setTags(tags.slice(0, -1));
            }}
          />
          <datalist id="e_tag_suggestions">
            {(known.data ?? [])
              .filter(
                (k) =>
                  !tags.some((t) => t.toLowerCase() === k.tag.toLowerCase()),
              )
              .map((k) => (
                <option key={k.tag} value={k.tag} />
              ))}
          </datalist>
        </Field>
        <Field label="Status" htmlFor="e_status">
          <Select
            id="e_status"
            value={form.status}
            onValueChange={(value) => setForm({ ...form, status: value })}
          >
            <option value="active">Active</option>
            <option value="blocked">Blocked</option>
          </Select>
        </Field>
        <label className="flex items-center gap-space-2 text-[14px]">
          <input
            type="checkbox"
            checked={form.optIn}
            onChange={(e) => setForm({ ...form, optIn: e.target.checked })}
          />
          Customer agreed to receive WhatsApp messages
        </label>
      </Modal>

      <Modal
        open={adjusting}
        onClose={() => setAdjusting(false)}
        title="Adjust loyalty points"
        description={`Current balance: ${c.loyalty.points} points.`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAdjusting(false)}>
              Cancel
            </Button>
            <Button
              disabled={busy || !adjust.delta || !adjust.reason.trim()}
              onClick={saveAdjust}
            >
              Save
            </Button>
          </>
        }
      >
        <Field label="Points (negative to take away)" htmlFor="l_delta">
          <Input
            id="l_delta"
            inputMode="numeric"
            value={adjust.delta}
            onChange={(e) =>
              setAdjust({
                ...adjust,
                delta: e.target.value.replace(/[^\d-]/g, ""),
              })
            }
          />
        </Field>
        <Field label="Reason" htmlFor="l_reason" required>
          <Input
            id="l_reason"
            value={adjust.reason}
            onChange={(e) => setAdjust({ ...adjust, reason: e.target.value })}
          />
        </Field>
      </Modal>
    </div>
  );
}
