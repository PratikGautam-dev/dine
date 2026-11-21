"use client";

import {
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  Globe,
  Link2,
  MoreHorizontal,
  RefreshCw,
  Star,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { SettingsPageFrame } from "@/components/portal/settings/SettingsPageFrame";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { Badge } from "@/components/erp-ui/Badge";
import { Button } from "@/components/erp-ui/Button";
import { Card } from "@/components/erp-ui/Card";
import { ConfirmDialog } from "@/components/erp-ui/ConfirmDialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/erp-ui/dropdown-menu";
import { Field } from "@/components/erp-ui/Field";
import { Input } from "@/components/erp-ui/Input";
import { Modal } from "@/components/erp-ui/Modal";
import { SkeletonLines } from "@/components/erp-ui/Skeleton";
import {
  useCheckDomain,
  useConnectDomain,
  useDomains,
  useRemoveDomain,
  useSetPrimaryDomain,
  type DnsRecord,
  type DomainStatus,
  type StoreDomain,
} from "@/hooks/useDomains";
import { formatShortDateTime } from "@/lib/formatDate";
import { usePermission } from "@/lib/staffAuth";
import { toast } from "@/lib/toast";

const STATUS: Record<
  DomainStatus,
  { label: string; tone: "success" | "warning" | "error" | "neutral" }
> = {
  connected: { label: "Connected", tone: "success" },
  pending: { label: "Pending", tone: "warning" },
  attention: { label: "Needs attention", tone: "error" },
  expired: { label: "Expired", tone: "neutral" },
};

const PURPOSE: Record<DnsRecord["purpose"], string> = {
  website: "Points the domain to your store",
  ownership: "Proves the domain is yours",
  host: "Asked for by our website host",
};

/** Settings > Domains: the shop's addresses, like Shopify's Domains page. The platform address always exists; own domains are optional. */
export default function DomainsSettingsPage() {
  const { restaurant, ready } = usePortalGuard();
  const canEdit = usePermission("settings", "write");
  const list = useDomains({ enabled: ready });
  const setPrimary = useSetPrimaryDomain();
  const [connecting, setConnecting] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  if (!ready) return null;
  const data = list.data;
  const roots = data?.domains.filter((d) => d.kind === "custom") ?? [];
  const twins = (id: string) =>
    data?.domains.filter((d) => d.parent_id === id) ?? [];
  const open = data?.domains.find((d) => d.id === openId) ?? null;

  const makePrimary = (domainId: string | null, label: string) =>
    setPrimary.mutate(domainId, {
      onSuccess: () => toast.success(`${label} is now your primary domain`),
      onError: (e) =>
        toast.error("Couldn't change the primary domain", e.message),
    });

  const platformRow = data?.platform.host ? (
    <Row
      icon={<Globe size={16} />}
      host={data.platform.host}
      primary={data.platform.is_primary}
      status="connected"
      note="Free address, always available"
      menu={
        canEdit && !data.platform.is_primary ? (
          <DropdownMenuItem
            onClick={() => makePrimary(null, data.platform.host!)}
          >
            <Star size={15} /> Set as primary
          </DropdownMenuItem>
        ) : null
      }
      href={data.platform.url ?? undefined}
    />
  ) : null;

  return (
    <SettingsPageFrame
      restaurant={restaurant}
      maxWidthClass="max-w-3xl"
      icon={<Globe size={20} />}
      title="Domains"
      description="The addresses your storefront answers on. Shoppers on any of them are sent to your primary domain."
      actions={
        canEdit && data?.enabled ? (
          <Button onClick={() => setConnecting(true)}>
            <Link2 size={15} /> Connect existing domain
          </Button>
        ) : undefined
      }
    >
      <div className="space-y-space-3">
        {data && !data.enabled && (
          <Card className="p-space-4 text-[13.5px] text-ink-600">
            Connecting your own domain isn&apos;t switched on for this platform
            yet. Your store is available at its free address below.
          </Card>
        )}
        <Card className="overflow-hidden p-0">
          <div className="flex items-center justify-between border-b border-line bg-black/[0.02] px-space-4 py-2 text-[12.5px] font-semibold text-ink-600">
            <span>Domain</span>
            <span className="pr-12">Status</span>
          </div>
          <p className="border-b border-line px-space-4 py-2 text-[13px] font-medium text-ink-900">
            Website
          </p>
          {list.isPending ? (
            <div className="p-space-5">
              <SkeletonLines rows={3} />
            </div>
          ) : list.error ? (
            <p className="p-space-5 text-[14px] text-error">
              Couldn&apos;t load your domains: {list.error.message}
            </p>
          ) : (
            <div className="divide-y divide-line">
              {/* the primary address first, like Shopify */}
              {data?.platform.is_primary && platformRow}
              {roots.map((d) => (
                <div key={d.id}>
                  <Row
                    icon={<Globe size={16} />}
                    host={d.host}
                    primary={d.is_primary && d.status === "connected"}
                    status={d.status}
                    note={
                      d.status === "connected"
                        ? undefined
                        : (d.error ?? undefined)
                    }
                    onOpen={() => setOpenId(d.id)}
                    href={
                      d.status === "connected" ? `https://${d.host}` : undefined
                    }
                  />
                  {twins(d.id).map((t) => (
                    <Row
                      key={t.id}
                      indent
                      host={t.host}
                      primary={false}
                      status={t.status}
                      note={`Redirects to ${d.host}`}
                      onOpen={() => setOpenId(d.id)}
                    />
                  ))}
                </div>
              ))}
              {!data?.platform.is_primary && platformRow && (
                <div className="bg-black/[0.01]">{platformRow}</div>
              )}
            </div>
          )}
        </Card>
        {data && (
          <p className="text-[12.5px] text-ink-600">
            Your storefront is live at{" "}
            <a
              href={data.primary_url ?? undefined}
              target="_blank"
              rel="noreferrer"
              className="underline"
            >
              {data.primary_host ?? data.platform.host}
            </a>
            . You can connect up to {data.max_domains} domains you own; buy a
            domain from any registrar (Hostinger, GoDaddy…) first.
          </p>
        )}
      </div>

      {connecting && (
        <ConnectDialog
          onClose={() => setConnecting(false)}
          onConnected={(id) => {
            setConnecting(false);
            setOpenId(id);
          }}
        />
      )}
      {open && (
        <DomainDialog
          key={open.id}
          domain={open}
          twins={twins(open.id)}
          canEdit={canEdit}
          onPrimary={() => makePrimary(open.id, open.host)}
          onClose={() => setOpenId(null)}
        />
      )}
    </SettingsPageFrame>
  );
}

function Row({
  icon,
  host,
  primary,
  status,
  note,
  indent = false,
  menu,
  href,
  onOpen,
}: {
  icon?: React.ReactNode;
  host: string;
  primary: boolean;
  status: DomainStatus;
  note?: string;
  indent?: boolean;
  menu?: React.ReactNode;
  href?: string;
  onOpen?: () => void;
}) {
  const s = STATUS[status];
  const body = (
    <span
      className={`flex min-w-0 flex-1 items-center gap-space-2 ${indent ? "pl-space-6" : ""}`}
    >
      {indent ? (
        <span
          aria-hidden
          className="h-4 w-3 shrink-0 border-b border-l border-line"
        />
      ) : (
        <span className="shrink-0 text-ink-600">{icon}</span>
      )}
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-space-2">
          <span className="truncate text-[14px] text-ink-900">{host}</span>
          {primary && (
            <span className="rounded-md border border-line px-1.5 py-0.5 text-[11.5px] text-ink-600">
              Primary
            </span>
          )}
        </span>
        {note && (
          <span className="block text-[12.5px] text-ink-600">{note}</span>
        )}
      </span>
    </span>
  );
  return (
    <div className="flex items-center gap-space-3 px-space-4 py-space-3">
      {onOpen ? (
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 flex-1 text-left hover:underline"
        >
          {body}
        </button>
      ) : (
        body
      )}
      <Badge tone={s.tone}>{s.label}</Badge>
      <span className="flex w-9 shrink-0 justify-end">
        {menu || href ? (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Actions for ${host}`}
              className="flex h-8 w-8 items-center justify-center rounded-md text-ink-900 hover:bg-black/[0.04]"
            >
              <MoreHorizontal size={16} />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {href && (
                <DropdownMenuItem
                  onClick={() => window.open(href, "_blank", "noreferrer")}
                >
                  <ExternalLink size={15} /> Visit
                </DropdownMenuItem>
              )}
              {menu}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : onOpen ? (
          <ChevronRight size={16} className="text-ink-600" />
        ) : null}
      </span>
    </div>
  );
}

function ConnectDialog({
  onClose,
  onConnected,
}: {
  onClose: () => void;
  onConnected: (id: string) => void;
}) {
  const connect = useConnectDomain();
  const [host, setHost] = useState("");
  const submit = () =>
    connect.mutate(host, {
      onSuccess: (r) => onConnected(r.domains[0].id),
      onError: (e) => toast.error("Couldn't connect the domain", e.message),
    });
  return (
    <Modal
      open
      title="Connect existing domain"
      description="A domain you already own, for example yourshop.com. You'll add a few DNS records where you bought it."
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={!host.trim() || connect.isPending} onClick={submit}>
            {connect.isPending ? "Connecting…" : "Next"}
          </Button>
        </>
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (host.trim()) submit();
        }}
      >
        <Field
          label="Domain"
          htmlFor="connect-domain"
          hint="Enter it without www; www is added for you and sent to it."
        >
          <Input
            id="connect-domain"
            autoFocus
            value={host}
            placeholder="yourshop.com"
            onChange={(e) => setHost(e.target.value)}
          />
        </Field>
      </form>
    </Modal>
  );
}

function DomainDialog({
  domain,
  twins,
  canEdit,
  onPrimary,
  onClose,
}: {
  domain: StoreDomain;
  twins: StoreDomain[];
  canEdit: boolean;
  onPrimary: () => void;
  onClose: () => void;
}) {
  const check = useCheckDomain();
  const remove = useRemoveDomain();
  const [confirmRemove, setConfirmRemove] = useState(false);
  const records = [
    ...domain.dns_records,
    ...twins.flatMap((t) => t.dns_records),
  ];
  const s = STATUS[domain.status];
  const connected = domain.status === "connected";
  return (
    <>
      <Modal
        open
        title={domain.host}
        width="lg"
        onClose={onClose}
        footer={
          <>
            {canEdit && (
              <Button
                variant="destructive"
                className="mr-auto"
                onClick={() => setConfirmRemove(true)}
              >
                <Trash2 size={15} /> Remove
              </Button>
            )}
            {canEdit && connected && !domain.is_primary && (
              <Button variant="secondary" onClick={onPrimary}>
                <Star size={15} /> Set as primary
              </Button>
            )}
            {domain.status !== "expired" && (
              <Button
                disabled={check.isPending}
                onClick={() =>
                  check.mutate(domain.id, {
                    onSuccess: (r) => {
                      const now = r.domains[0];
                      if (now.status === "connected")
                        toast.success(`${now.host} is connected`);
                      else toast.info(now.error ?? "Not connected yet");
                    },
                    onError: (e) =>
                      toast.error("Couldn't check the domain", e.message),
                  })
                }
              >
                <RefreshCw
                  size={15}
                  className={check.isPending ? "animate-spin" : ""}
                />{" "}
                {check.isPending ? "Checking…" : "Check now"}
              </Button>
            )}
          </>
        }
      >
        <div className="space-y-space-4">
          <div className="flex flex-wrap items-center gap-space-2 text-[13.5px]">
            <Badge tone={s.tone}>{s.label}</Badge>
            {domain.is_primary && connected && (
              <span className="text-ink-600">Primary domain</span>
            )}
            {domain.last_checked_at && (
              <span className="text-ink-600">
                Last checked {formatShortDateTime(domain.last_checked_at)}
              </span>
            )}
          </div>
          {domain.error && !connected && (
            <p className="text-[13.5px] text-ink-900">{domain.error}</p>
          )}
          {domain.status === "expired" ? (
            <p className="text-[13.5px] text-ink-600">
              Remove it and connect the domain again to get fresh records.
            </p>
          ) : (
            <>
              <p className="text-[13.5px] text-ink-600">
                {connected
                  ? "Keep these records at your domain provider. Removing them disconnects the domain."
                  : "Add these records where you manage the domain's DNS (for example Hostinger → Domains → DNS / Nameservers). Don't change your email (MX) records. Changes can take up to 48 hours; we keep checking automatically."}
                {domain.expires_at && !connected && (
                  <> Waiting until {formatShortDateTime(domain.expires_at)}.</>
                )}
              </p>
              <RecordsTable records={records} />
            </>
          )}
        </div>
      </Modal>
      <ConfirmDialog
        open={confirmRemove}
        title={`Remove ${domain.host}?`}
        message={
          domain.is_primary
            ? "Your store moves back to its free address straight away. You can connect the domain again later."
            : "The domain stops opening your store. You can connect it again later."
        }
        confirmLabel="Remove domain"
        destructive
        busy={remove.isPending}
        onCancel={() => setConfirmRemove(false)}
        onConfirm={() =>
          remove.mutate(domain.id, {
            onSuccess: () => {
              toast.success(`${domain.host} removed`);
              setConfirmRemove(false);
              onClose();
            },
            onError: (e) =>
              toast.error("Couldn't remove the domain", e.message),
          })
        }
      />
    </>
  );
}

function RecordsTable({ records }: { records: DnsRecord[] }) {
  return (
    <div className="overflow-x-auto rounded-md border border-line">
      <table className="w-full min-w-[520px] text-left text-[13px]">
        <thead className="bg-black/[0.02] text-[12px] text-ink-600">
          <tr>
            <th className="px-space-3 py-2 font-semibold">Type</th>
            <th className="px-space-3 py-2 font-semibold">Name</th>
            <th className="px-space-3 py-2 font-semibold">Value</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {records.map((r) => (
            <tr key={`${r.type}-${r.host}-${r.value}`} className="align-top">
              <td className="px-space-3 py-2 font-medium text-ink-900">
                {r.type}
              </td>
              <td className="px-space-3 py-2">
                <CopyText text={r.name} />
                <span className="block text-[11.5px] text-ink-600">
                  {PURPOSE[r.purpose]}
                </span>
              </td>
              <td className="px-space-3 py-2">
                <CopyText text={r.value} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CopyText({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      title="Copy"
      onClick={() =>
        navigator.clipboard?.writeText(text).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        })
      }
      className="inline-flex max-w-full items-center gap-1.5 rounded px-1 text-left font-mono text-[12.5px] break-all text-ink-900 hover:bg-black/[0.04]"
    >
      <span className="break-all">{text}</span>
      {copied ? (
        <Check size={13} className="shrink-0 text-success" />
      ) : (
        <Copy size={13} className="shrink-0 text-ink-600" />
      )}
    </button>
  );
}
