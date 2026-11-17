"use client";

import Link from "next/link";
import { useState } from "react";
import { CashiersPanel, TerminalsPanel } from "@/components/portal/channels/BranchTerminals";
import { WhatsAppConnect } from "@/components/portal/channels/WhatsAppConnect";
import { Badge } from "@/components/erp-ui/Badge";
import { Button } from "@/components/erp-ui/Button";
import { Card } from "@/components/erp-ui/Card";
import { Select } from "@/components/erp-ui/Select";
import { Switch } from "@/components/erp-ui/Switch";
import { useChannelReadiness, type Readiness } from "@/hooks/useChannels";
import { useChannelBranches, useTerminalSummary, useTogglePosBranch } from "@/hooks/useTerminals";
import { formatDateTime, type Channel } from "@/lib/erp/erp";
import { hasPermission, useStaffSession } from "@/lib/erp/staffAuth";
import { toast } from "@/lib/toast";

export type { Readiness, ReadinessItem } from "@/hooks/useChannels";

export type ChannelStatus = {
  label: string;
  tone: "success" | "warning" | "neutral";
};

/** The checklist for one channel, worked out by the server from real data (see services/onboarding.py). Null without the settings permission. */
export function useReadiness(channel: Channel) {
  const session = useStaffSession();
  // Dine has no separate channel permission: the channel pages sit on the Settings page's permission.
  return useChannelReadiness(channel, hasPermission(session, "settings", "view"));
}

export const readinessStatus = (
  r: Readiness | null | undefined,
): ChannelStatus =>
  !r
    ? { label: "Not set up", tone: "neutral" }
    : r.ready
        ? { label: "Ready", tone: "success" }
        : {
            label: r.met ? `${r.met} of ${r.total} done` : "Not set up",
            tone: r.met ? "warning" : "neutral",
          };

/** Setup state of every channel, for the list page. */
export function useChannelStatuses(): Record<Channel, ChannelStatus> | null {
  const online = useReadiness("online");
  const pos = useReadiness("pos");
  const whatsapp = useReadiness("whatsapp");
  if (online.isFetching || pos.isFetching || whatsapp.isFetching) return null;
  return {
    online: readinessStatus(online.data),
    pos: readinessStatus(pos.data),
    whatsapp: readinessStatus(whatsapp.data),
  };
}

/** What is left before this channel can take orders. Each line says what to do and links to where. */
export function ChannelReadiness({ channel }: { channel: Channel }) {
  const { data, isFetching: loading } = useReadiness(channel);
  if (loading || !data) return null;
  const status = readinessStatus(data);
  return (
    <Card className="mb-space-5 p-space-4">
      <div className="mb-space-3 flex flex-wrap items-center justify-between gap-space-2">
        <h2 className="text-[15px] font-bold text-ink-900">Setup checklist</h2>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <ul className="divide-y divide-line">
        {data.items.map((i) => (
          <li
            key={i.key}
            className="flex items-start gap-space-3 py-space-2 text-[13.5px]"
          >
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${i.done ? "bg-success-tint text-success" : "bg-black/[0.05] text-ink-400"}`}
              aria-label={i.done ? "done" : "not done"}
            >
              {i.done ? "✓" : ""}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={`block font-medium ${i.done ? "text-ink-600" : "text-ink-900"}`}
              >
                {i.label}
                {!i.required && (
                  <span className="ml-1 text-[12px] font-normal text-ink-400">
                    (optional)
                  </span>
                )}
              </span>
              {!i.done && (
                <span className="block text-[12.5px] text-ink-600">
                  {i.available ? i.hint : `${i.hint}`}
                </span>
              )}
            </span>
            {!i.done && i.available && (
              <Link
                href={i.href}
                className="shrink-0 font-semibold text-brand-600 hover:underline"
              >
                Go
              </Link>
            )}
            {!i.available && <Badge tone="neutral">Coming soon</Badge>}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Website settings: how orders reach the restaurant from its own site. The storefront itself is edited on the Website page. */
export function OnlineChannelPanel() {
  return (
    <>
      <p className="max-w-2xl text-[14px] text-ink-600">
        Your restaurant&apos;s website takes orders straight from your menu. Orders it receives are recorded on the <strong>Website</strong>{" "}
        channel and appear in Food orders and Customers like any other order.
      </p>
      <Card className="mt-space-5 p-space-4">
        <h2 className="text-[15px] font-bold text-ink-900">Store link and ordering</h2>
        <p className="mb-space-3 text-[13px] text-ink-600">
          Choose your store link, switch website ordering on or off and customize the site on the Website page.
        </p>
        <div className="flex flex-wrap gap-space-2">
          <Link href="/portal/channels/online#online-storefront">
            <Button variant="secondary">Store link and ordering</Button>
          </Link>
          <Link href="/portal/channels/online">
            <Button variant="secondary">Customize website</Button>
          </Link>
        </div>
      </Card>
    </>
  );
}

/** POS settings: which branches take POS sales, every till branch at a glance (one summary request), then terminals and cashiers for the branch picked.
 * Nothing is fetched for a branch until it is picked. */
export function PosChannelPanel() {
  const session = useStaffSession();
  const canEdit = hasPermission(session, "settings", "write");
  const branches = useChannelBranches();
  const summary = useTerminalSummary();
  const toggle = useTogglePosBranch();
  const [picked, setPicked] = useState<string | null>(null);
  const all = branches.data ?? [];
  const posBranches = all.filter((b) => b.accepts_pos);
  const selected = posBranches.find((b) => b.id === picked) ?? posBranches[0] ?? null;
  const stats = new Map((summary.data ?? []).map((t) => [t.branch_id, t]));
  const total = [...stats.values()].reduce((a, t) => ({ paired: a.paired + t.paired, online: a.online + t.online }), { paired: 0, online: 0 });

  return (
    <>
      <p className="max-w-2xl text-[14px] text-ink-600">
        Each till is paired to one branch. Switch on POS for a branch, then pair terminals and set cashier PINs for it.
      </p>
      <Card className="mt-space-5 min-w-0 p-space-3 md:p-space-4">
        <div className="mb-space-3">
          <h2 className="text-[15px] font-bold text-ink-900">Branches</h2>
          <p className="text-[13px] text-ink-600">
            {summary.data
              ? `${total.paired} terminal${total.paired === 1 ? "" : "s"} paired · ${total.online} connected now`
              : summary.error
                ? summary.error.message
                : "Loading…"}
          </p>
        </div>
        {branches.error && <p className="text-[13px] text-error">{branches.error.message}</p>}
        <ul className="divide-y divide-line">
          {all.map((b) => {
            const t = stats.get(b.id);
            const paired = t?.paired ?? 0;
            return (
              <li key={b.id} className="flex flex-col gap-space-2 py-space-3 text-[13.5px]">
                <div className="flex w-full min-w-0 items-center justify-between gap-space-2">
                  <span className="min-w-0 break-words font-medium text-ink-900">{b.branch_name}</span>
                  <span className="flex shrink-0 items-center gap-space-2">
                    {b.accepts_pos && summary.data && <Badge tone={paired ? "success" : "warning"}>{paired ? `${paired} paired` : "No terminal"}</Badge>}
                    <Switch
                      checked={b.accepts_pos}
                      disabled={!canEdit || toggle.isPending || b.status !== "active"}
                      tone="success"
                      aria-label={`Takes POS sales: ${b.branch_name}`}
                      onChange={() =>
                        toggle.mutate(
                          { branchId: b.id, value: !b.accepts_pos },
                          {
                            onSuccess: () => toast.success(b.accepts_pos ? "POS switched off" : "POS switched on", b.branch_name),
                            onError: (e) => toast.error("Couldn't save", e.message),
                          },
                        )
                      }
                    />
                  </span>
                </div>
                {b.accepts_pos && paired > 0 && (
                  <p className="text-[12.5px] text-ink-600">
                    {t?.online ?? 0} connected · last seen {t?.last_seen_at ? formatDateTime(t.last_seen_at) : "never"}
                    {(t?.waiting_bills ?? 0) > 0 ? ` · ${t?.waiting_bills} bill${t?.waiting_bills === 1 ? "" : "s"} waiting on ${t?.tills_holding} till${t?.tills_holding === 1 ? "" : "s"}` : ""}
                  </p>
                )}
                {b.accepts_pos && selected?.id !== b.id && (
                  <div>
                    <Button variant="secondary" className="h-11 px-space-3 text-[12.5px]" onClick={() => setPicked(b.id)}>
                      Manage
                    </Button>
                  </div>
                )}
                {b.accepts_pos && selected?.id === b.id && <Badge tone="brand">Showing below</Badge>}
              </li>
            );
          })}
        </ul>
        {branches.data && posBranches.length === 0 && (
          <p className="mt-space-2 text-[13.5px] text-ink-400">No branch takes POS sales yet. Switch one on above.</p>
        )}
      </Card>

      {selected && (
        <>
          <div className="mt-space-5 flex flex-wrap items-center justify-between gap-space-3">
            <h2 className="min-w-0 break-words text-[16px] font-bold text-ink-900">{selected.branch_name}</h2>
            {posBranches.length > 1 && (
              <Select value={selected.id} onValueChange={(value) => setPicked(value)} className="w-full md:w-56" aria-label="Branch">
                {posBranches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.branch_name}
                  </option>
                ))}
              </Select>
            )}
          </div>
          <Card className="mt-space-3 min-w-0 p-space-3 md:p-space-4">
            <h3 className="mb-space-3 text-[15px] font-bold text-ink-900">POS terminals</h3>
            <TerminalsPanel key={selected.id} branchId={selected.id} />
          </Card>
          <Card className="mt-space-4 min-w-0 p-space-3 md:p-space-4">
            <h3 className="mb-space-3 text-[15px] font-bold text-ink-900">Cashiers</h3>
            <CashiersPanel key={selected.id} branchId={selected.id} />
          </Card>
        </>
      )}
    </>
  );
}

export function WhatsAppChannelPanel() {
  return (
    <>
      <p className="max-w-2xl text-[14px] text-ink-600">
        Orders and questions that arrive on WhatsApp are recorded on the <strong>WhatsApp</strong> channel. You connect your own WhatsApp
        Business number here. The ordering bot and templates are on the WhatsApp page in the sidebar.
      </p>
      <WhatsAppConnect />
    </>
  );
}
