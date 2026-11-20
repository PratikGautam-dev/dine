"use client";

import Link from "next/link";
import { useState } from "react";
import { CashiersPanel, TerminalsPanel } from "@/components/portal/channels/BranchTerminals";
import { ChannelConnections } from "@/components/portal/channels/ChannelConnections";
import { WhatsAppConnect } from "@/components/portal/channels/WhatsAppConnect";
import { Badge } from "@/components/erp-ui/Badge";
import { Button } from "@/components/erp-ui/Button";
import { Card } from "@/components/erp-ui/Card";
import { Select } from "@/components/erp-ui/Select";
import { Switch } from "@/components/erp-ui/Switch";
import { useChannelReadiness, type Readiness } from "@/hooks/useChannels";
import { useChannelBranches, useTerminalSummary, useToggleChannelBranch, type ChannelBranch } from "@/hooks/useTerminals";
import { CHANNELS, formatDateTime, type Channel } from "@/lib/erp/erp";
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

export const readinessStatus = (r: Readiness | null | undefined): ChannelStatus =>
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
          <li key={i.key} className="flex items-start gap-space-3 py-space-2 text-[13.5px]">
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${i.done ? "bg-success-tint text-success" : "bg-black/[0.05] text-ink-400"}`}
              aria-label={i.done ? "done" : "not done"}
            >
              {i.done ? "✓" : ""}
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block font-medium ${i.done ? "text-ink-600" : "text-ink-900"}`}>
                {i.label}
                {!i.required && (
                  <span className="ml-1 text-[12px] font-normal text-ink-400">(optional)</span>
                )}
              </span>
              {!i.done && (
                <span className="block text-[12.5px] text-ink-600">
                  {i.available ? i.hint : `${i.hint}`}
                </span>
              )}
            </span>
            {!i.done && i.available && (
              <Link href={i.href} className="shrink-0 font-semibold text-brand-600 hover:underline">
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

/** Which branches sell through the website or WhatsApp, switched here instead of opening each branch. */
export function ChannelBranches({ channel }: { channel: Channel }) {
  const session = useStaffSession();
  const branches = useChannelBranches();
  const toggleBranch = useToggleChannelBranch();
  const [busy, setBusy] = useState<string | null>(null);
  const canWrite = hasPermission(session, "settings", "write");
  const field = channel === "online" ? "accepts_online" : channel === "pos" ? "accepts_pos" : "accepts_whatsapp";
  const label = channel === "online" ? "Takes website orders" : channel === "pos" ? "Takes POS sales" : "Takes WhatsApp orders";
  const rows = (branches.data ?? []).filter((b) => b.status === "active");

  function toggle(b: ChannelBranch) {
    setBusy(b.id);
    toggleBranch.mutate(
      { branchId: b.id, field, value: !b[field] },
      { onError: (e) => toast.error("Couldn't update the branch", e.message), onSettled: () => setBusy(null) },
    );
  }

  return (
    <Card className="mt-space-5 min-w-0 p-space-3 md:p-space-4">
      <h2 className="text-[15px] font-bold text-ink-900">Branches on this channel</h2>
      <p className="mb-space-3 text-[13px] text-ink-600">
        Switch a branch on or off for {CHANNELS[channel].label}. More detail (hours, fees, minimum order) is on each branch&apos;s page.
      </p>
      {rows.length === 0 ? (
        <p className="text-[13.5px] text-ink-400">{branches.isFetching ? "Loading…" : "No active branches."}</p>
      ) : (
        <table className="w-full text-[13.5px]">
          <thead>
            <tr className="text-left text-[12px] text-ink-400">
              <th className="py-1">Branch</th>
              <th className="px-space-3">{label}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((b) => (
              <tr key={b.id} className="border-t border-line">
                <td className="py-2">
                  <span className="break-words font-medium text-ink-900">{b.branch_name}</span>
                </td>
                <td className="px-space-3">
                  <Switch checked={b[field]} disabled={!canWrite || busy === b.id} onChange={() => toggle(b)} aria-label={`${label}: ${b.branch_name}`} />
                </td>
                <td className="text-right">
                  <Link href={`/portal/settings/branches/${b.id}`} className="font-semibold text-brand-600 hover:underline">
                    Manage
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

/** Website settings: how orders reach the restaurant from its own site, and the API keys a site uses to place them. */
export function OnlineChannelPanel() {
  return (
    <>
      <p className="max-w-2xl text-[14px] text-ink-600">
        Your website talks to the backend with an API key. Orders it places are recorded on the <strong>Website</strong> channel and appear in Food orders and
        Customers like any other order.
      </p>
      <ChannelConnections channel="online" />
    </>
  );
}

/** POS settings: every till branch at a glance (one summary request), then terminals and cashiers for the branch picked below it.
 * Nothing is fetched for a branch until it is picked, and the branch list is just names and switches, not whole branch rows. */
export function PosChannelPanel() {
  const branches = useChannelBranches();
  const summary = useTerminalSummary();
  const [picked, setPicked] = useState<string | null>(null);
  const posBranches = (branches.data ?? []).filter((b) => b.accepts_pos);
  const selected = posBranches.find((b) => b.id === picked) ?? posBranches[0] ?? null;
  const stats = new Map((summary.data ?? []).map((t) => [t.branch_id, t]));
  const total = [...stats.values()].reduce(
    (a, t) => ({ paired: a.paired + t.paired, online: a.online + t.online }),
    { paired: 0, online: 0 },
  );

  return (
    <>
      <p className="max-w-2xl text-[14px] text-ink-600">
        Each till is paired to one branch. Pick a branch to pair terminals and set cashier PINs for it.
      </p>
      <Card className="mt-space-5 min-w-0 p-space-3 md:p-space-4">
        <div className="mb-space-3">
          <h2 className="text-[15px] font-bold text-ink-900">Branches with a till</h2>
          <p className="text-[13px] text-ink-600">
            {summary.data
              ? `${total.paired} terminal${total.paired === 1 ? "" : "s"} paired · ${total.online} connected now`
              : summary.error
                ? ""
                : "Loading…"}
          </p>
        </div>
        {branches.data && posBranches.length === 0 ? (
          <p className="text-[13.5px] text-ink-400">No active branch takes POS sales. Switch on “Takes POS sales” for a branch below.</p>
        ) : (
          <ul className="divide-y divide-line">
            {posBranches.map((b) => {
              const t = stats.get(b.id);
              const paired = t?.paired ?? 0;
              return (
                <li key={b.id} className="flex flex-col items-start gap-space-1 py-space-3 text-[13.5px]">
                  <div className="flex w-full min-w-0 items-start justify-between gap-space-2">
                    <span className="min-w-0 break-words font-medium text-ink-900">{b.branch_name}</span>
                    {summary.data && (
                      <Badge className="shrink-0" tone={paired ? "success" : "warning"}>
                        {paired ? `${paired} paired` : "No terminal"}
                      </Badge>
                    )}
                  </div>
                  {summary.data && paired > 0 && (
                    <p className="text-[12.5px] text-ink-600">
                      {t?.online ?? 0} connected · last seen {t?.last_seen_at ? formatDateTime(t.last_seen_at) : "never"}
                    </p>
                  )}
                  <div className="flex w-full flex-wrap items-center gap-space-2">
                    {(t?.waiting_bills ?? 0) > 0 && (
                      <Badge tone="warning">
                        {t?.waiting_bills} bill{t?.waiting_bills === 1 ? "" : "s"} waiting on {t?.tills_holding} till{t?.tills_holding === 1 ? "" : "s"}
                      </Badge>
                    )}
                    {selected?.id === b.id ? (
                      <Badge tone="brand">Showing below</Badge>
                    ) : (
                      <Button variant="secondary" className="h-11 px-space-3 text-[12.5px]" onClick={() => setPicked(b.id)}>
                        Manage
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
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
        Orders and questions that arrive on WhatsApp are recorded on the <strong>WhatsApp</strong>{" "}
        channel. You connect your own WhatsApp Business number here. The ordering bot and templates
        are on the WhatsApp page in the sidebar.
      </p>
      <WhatsAppConnect />
    </>
  );
}
