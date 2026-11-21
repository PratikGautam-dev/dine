"use client";

import { ChevronRight, Contact, ExternalLink, FileText, Landmark, Lock, ReceiptText, ScrollText, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { storefrontUrl } from "@/components/portal/channels/DineThemeEditor";
import { SettingsPageFrame } from "@/components/portal/settings/SettingsPageFrame";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { Badge } from "@/components/erp-ui/Badge";
import { Button } from "@/components/erp-ui/Button";
import { Card } from "@/components/erp-ui/Card";
import { Modal } from "@/components/erp-ui/Modal";
import { RichTextEditor } from "@/components/erp-ui/RichTextEditor";
import { SkeletonLines } from "@/components/erp-ui/Skeleton";
import { useStorefrontSettings } from "@/hooks/useStorefrontSettings";
import { Field } from "@/components/erp-ui/Field";
import { Input } from "@/components/erp-ui/Input";
import { Switch } from "@/components/erp-ui/Switch";
import {
  usePolicies,
  useReturnRules,
  useSavePolicy,
  useSaveReturnRules,
  type PolicyKind,
  type ReturnRules,
  type StorePolicy,
} from "@/hooks/usePolicies";
import { usePermission } from "@/lib/staffAuth";
import { toast } from "@/lib/toast";

const ICONS: Record<PolicyKind, LucideIcon> = {
  returns: ReceiptText,
  privacy: Lock,
  terms: ScrollText,
  contact: Contact,
  legal: Landmark,
};

/** Settings > Policies: the restaurant's written policies, edited with formatting and shown on its storefront (footer + one page each). */
export default function PoliciesSettingsPage() {
  const { restaurant, ready } = usePortalGuard();
  const policies = usePolicies();
  const canWrite = usePermission("settings", "write");
  const storefront = useStorefrontSettings(ready);
  const rules = useReturnRules();
  const [open, setOpen] = useState<StorePolicy | null>(null);
  const [editingRules, setEditingRules] = useState(false);
  if (!ready) return null;
  const slug = storefront.storefront?.slug ?? null;

  return (
    <SettingsPageFrame
      restaurant={restaurant}
      maxWidthClass="max-w-2xl"
      title="Policies"
      icon={<FileText size={20} />}
      description="Written policies appear on your storefront, linked from the footer."
    >
      <div className="space-y-space-3">
        {rules.data && <ReturnRulesCard rules={rules.data} onEdit={() => setEditingRules(true)} />}
        {rules.data && editingRules && <ReturnRulesEditor rules={rules.data} canEdit={canWrite} onClose={() => setEditingRules(false)} />}
        <h2 className="pt-space-2 text-[15px] font-bold text-ink-900">Written policies</h2>
        <Card className="divide-y divide-line p-0">
          {policies.isPending ? (
            <div className="p-space-5">
              <SkeletonLines rows={4} />
            </div>
          ) : policies.error ? (
            <p className="p-space-5 text-[14px] text-error">Couldn&apos;t load your policies: {policies.error.message}</p>
          ) : (
            policies.data.map((p) => {
              const Icon = ICONS[p.kind];
              return (
                <button
                  key={p.kind}
                  type="button"
                  onClick={() => setOpen(p)}
                  className="flex w-full items-center gap-space-3 px-space-4 py-space-3 text-left hover:bg-black/[0.03]"
                >
                  <Icon size={17} className="shrink-0 text-ink-600" />
                  <span className="min-w-0 flex-1 text-[14px] text-ink-900">{p.title}</span>
                  {p.published ? <Badge tone="success">Published</Badge> : <Badge tone="neutral">No policy set</Badge>}
                  <ChevronRight size={16} className="shrink-0 text-ink-600" />
                </button>
              );
            })
          )}
        </Card>
        <p className="text-[12.5px] text-ink-600">
          These policies are not legal advice. You are responsible for making sure they are accurate and comply with the law.
        </p>
      </div>
      {open && (
        <PolicyEditor
          key={open.kind}
          policy={open}
          canEdit={canWrite}
          liveUrl={slug ? `${storefrontUrl()}/${slug}/policies/${open.kind}` : null}
          onClose={() => setOpen(null)}
        />
      )}
    </SettingsPageFrame>
  );
}

function PolicyEditor({ policy, canEdit, liveUrl, onClose }: { policy: StorePolicy; canEdit: boolean; liveUrl: string | null; onClose: () => void }) {
  const save = useSavePolicy();
  const [html, setHtml] = useState(policy.body_html);
  const changed = html !== policy.body_html;
  return (
    <Modal
      open
      title={policy.title}
      width="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          {canEdit && (
            <Button
              disabled={!changed || save.isPending}
              onClick={() =>
                save.mutate(
                  { kind: policy.kind, body_html: html },
                  {
                    onSuccess: (saved) => {
                      toast.success(saved.published ? `${saved.title} saved` : `${saved.title} removed from your storefront`);
                      onClose();
                    },
                    onError: (error) => toast.error("Couldn't save the policy", error.message),
                  },
                )
              }
            >
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          )}
        </>
      }
    >
      <div className="space-y-space-3">
        <RichTextEditor value={html} onChange={setHtml} disabled={!canEdit} />
        {liveUrl && (
          <p className="flex flex-wrap items-center gap-1 text-[12.5px] text-ink-600">
            Shown on your storefront at
            <a href={liveUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
              {liveUrl.replace(/^https?:\/\//, "")} <ExternalLink size={12} />
            </a>
            {policy.published ? "" : " once you save some text."}
          </p>
        )}
      </div>
    </Modal>
  );
}

const days = (n: number) => (n <= 0 ? "no returns" : `${n} ${n === 1 ? "day" : "days"}`);

/** The return rules the till, website and portal enforce, next to the written return policy. */
function ReturnRulesCard({ rules, onEdit }: { rules: ReturnRules; onEdit: () => void }) {
  const rows = [
    ["Website and WhatsApp orders", `${days(rules.online_window_days)} from delivery`],
    ["Counter (POS) bills", `${days(rules.pos_window_days)} from the bill`],
    ["Exchanges", rules.exchanges_enabled ? "On" : "Off"],
    ["Refund as store credit", rules.store_credit_enabled ? "On" : "Off"],
    ["Refund as loyalty points", rules.loyalty_enabled ? "On" : "Off"],
  ];
  return (
    <>
      <div className="flex items-end justify-between gap-space-3">
        <div>
          <h2 className="text-[15px] font-bold text-ink-900">Return rules</h2>
          <p className="text-[13px] text-ink-600">Applied on the till, the website and in the portal. Keep your written return policy in line with them.</p>
        </div>
        <button type="button" onClick={onEdit} className="shrink-0 text-[13px] font-medium text-ink-900 underline">
          Edit
        </button>
      </div>
      <Card className="divide-y divide-line p-0">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-space-3 px-space-4 py-space-3 text-[14px]">
            <span className="text-ink-900">{label}</span>
            <span className="text-ink-600">{value}</span>
          </div>
        ))}
      </Card>
    </>
  );
}

function ReturnRulesEditor({ rules, canEdit, onClose }: { rules: ReturnRules; canEdit: boolean; onClose: () => void }) {
  const save = useSaveReturnRules();
  const [draft, setDraft] = useState(rules);
  const valid = [draft.online_window_days, draft.pos_window_days].every((v) => Number.isInteger(v) && v >= 0 && v <= 365);
  const changed = JSON.stringify(draft) !== JSON.stringify(rules);
  const dayField = (key: "pos_window_days" | "online_window_days", label: string, hint: string) => (
    <Field label={label} htmlFor={key} hint={hint}>
      <div className="flex items-center gap-space-2">
        <Input
          id={key}
          type="number"
          min={0}
          max={365}
          disabled={!canEdit}
          value={draft[key]}
          onChange={(e) => setDraft({ ...draft, [key]: e.target.value === "" ? 0 : Math.floor(Number(e.target.value)) })}
          className="w-28"
        />
        <span className="text-[13px] text-ink-600">days</span>
      </div>
    </Field>
  );
  const toggle = (key: "exchanges_enabled" | "store_credit_enabled" | "loyalty_enabled", label: string, hint: string) => (
    <div className="flex items-start justify-between gap-space-4 py-space-2">
      <div>
        <p className="text-[14px] font-semibold text-ink-900">{label}</p>
        <p className="text-[12.5px] text-ink-600">{hint}</p>
      </div>
      <Switch checked={draft[key]} disabled={!canEdit} onChange={() => setDraft({ ...draft, [key]: !draft[key] })} />
    </div>
  );
  return (
    <Modal
      open
      title="Return rules"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          {canEdit && (
            <Button
              disabled={!changed || !valid || save.isPending}
              onClick={() =>
                save.mutate(draft, {
                  onSuccess: () => {
                    toast.success("Return rules saved");
                    onClose();
                  },
                  onError: (e: Error) => toast.error("Couldn't save", e.message),
                })
              }
            >
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          )}
        </>
      }
    >
      <p className="mb-space-3 text-[13px] text-ink-600">
        Returns are refused once the window has passed. Set 0 days to stop returns on that channel.
      </p>
      <div className="grid gap-space-4 sm:grid-cols-2">
        {dayField("pos_window_days", "Counter (POS) bills", "Counted from the day of the bill.")}
        {dayField("online_window_days", "Website and WhatsApp orders", "Counted from the day the order was delivered.")}
      </div>
      <div className="divide-y divide-line border-t border-line pt-space-2">
        {toggle("exchanges_enabled", "Take exchanges", "Swap returned items for others; the customer pays any difference.")}
        {toggle("store_credit_enabled", "Refund as store credit", "Let staff and customers choose store credit instead of money.")}
        {toggle("loyalty_enabled", "Refund as loyalty points", "Let staff and website customers take a return as loyalty points (members only).")}
      </div>
    </Modal>
  );
}
