"use client";

import { useState } from "react";
import { Badge } from "@/components/erp-ui/Badge";
import { Button } from "@/components/erp-ui/Button";
import { Card } from "@/components/erp-ui/Card";
import { Field } from "@/components/erp-ui/Field";
import { Input } from "@/components/erp-ui/Input";
import { Modal } from "@/components/erp-ui/Modal";
import { Select } from "@/components/erp-ui/Select";
import { erp } from "@/lib/erp/erp";
import { cn } from "@/lib/cn";
import {
  MESSAGE_CHANNELS,
  SEGMENT_META,
  TEXTAREA_CLASS,
  initials,
  type CrmMessage,
  type MessageChannel,
  type Segment,
} from "@/lib/erp/crm";
import { toast } from "@/lib/toast";

export function SegmentBadge({ segment }: { segment: Segment }) {
  const m = SEGMENT_META[segment];
  return <Badge tone={m.tone}>{m.label}</Badge>;
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-brand-50 font-bold text-brand-700"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

export function KpiTile({
  label,
  value,
  hint,
  icon,
  stackOnMobile = false,
  stacked = false,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  icon?: React.ReactNode;
  /** Give narrow summary cards the full width for their labels and values. */
  stackOnMobile?: boolean;
  /** Always icon above text, at every width: for a row of many narrow cards. */
  stacked?: boolean;
}) {
  if (stacked)
    return (
      <Card className="flex min-w-0 flex-col items-start gap-space-2 p-space-3">
        {icon && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            {icon}
          </span>
        )}
        <div className="w-full min-w-0">
          <p className="min-h-8 break-words text-[12px] text-ink-600">
            {label}
          </p>
          <p className="break-words text-[18px] font-bold leading-tight text-ink-900">
            {value}
          </p>
          {hint && (
            <p className="break-words text-[11px] text-ink-400">{hint}</p>
          )}
        </div>
      </Card>
    );
  return (
    <Card
      className={cn(
        "flex p-space-3",
        stackOnMobile
          ? "min-w-0 flex-col items-start gap-space-2 md:flex-row md:items-center md:gap-space-3"
          : "items-center gap-space-3",
      )}
    >
      {icon && (
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700",
            stackOnMobile ? "h-9 w-9 md:h-10 md:w-10" : "h-10 w-10",
          )}
        >
          {icon}
        </span>
      )}
      <div className={cn("min-w-0", stackOnMobile && "w-full md:w-auto")}>
        <p
          className={cn(
            "text-[12px] text-ink-600",
            stackOnMobile
              ? "min-h-8 break-words md:min-h-0 md:truncate"
              : "truncate",
          )}
        >
          {label}
        </p>
        <p
          className={cn(
            stackOnMobile
              ? "break-words text-[18px] md:text-[20px]"
              : "text-[20px]",
            "font-bold leading-tight text-ink-900",
          )}
        >
          {value}
        </p>
        {hint && (
          <p
            className={cn(
              "text-[11px] text-ink-400",
              stackOnMobile ? "break-words md:truncate" : "truncate",
            )}
          >
            {hint}
          </p>
        )}
      </div>
    </Card>
  );
}

const STATUS_TONE = {
  queued: "warning",
  sending: "warning",
  sent: "success",
  delivered: "success",
  read: "success",
  failed: "error",
} as const;
const STATUS_LABEL = {
  queued: "Saved, not sent",
  sending: "Sending",
  sent: "Sent",
  delivered: "Delivered",
  read: "Read",
  failed: "Failed",
} as const;

const sentAt = (v: string) =>
  new Date(v).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

/** One message as a card: who it went to and when, its channel and status, then the text as sent. */
function MessageCard({ m }: { m: CrmMessage }) {
  const name = m.customer_name ?? "Customer";
  return (
    <li className="rounded-xl border border-line bg-card p-space-3 shadow-sm">
      <div className="flex items-center gap-space-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-800 text-[15px] font-bold text-white">
          {name.trim().charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14.5px] font-semibold text-ink-900">
            {name}
          </p>
          <p className="text-[12px] text-ink-500">
            {MESSAGE_CHANNELS[m.channel]} · {sentAt(m.created_at)}
          </p>
        </div>
        <Badge tone={STATUS_TONE[m.status]}>
          {m.status === "queued" && m.channel === "whatsapp"
            ? "Waiting to send"
            : STATUS_LABEL[m.status]}
        </Badge>
      </div>
      {m.subject && (
        <p className="mt-space-3 text-[13.5px] font-semibold text-ink-900">
          {m.subject}
        </p>
      )}
      <p className="mt-space-3 max-w-[92%] rounded-2xl rounded-tl-sm border border-brand-200 bg-brand-50 px-space-4 py-space-3 text-[13.5px] leading-relaxed whitespace-pre-wrap text-ink-800">
        {m.body}
      </p>
      {m.error && (
        <p className="mt-space-2 text-[12px] text-ink-500">{m.error}</p>
      )}
    </li>
  );
}

export function MessageList({
  messages,
  showCustomer,
  empty,
  cards,
}: {
  messages: CrmMessage[];
  showCustomer?: boolean;
  empty: string;
  /** Each message as its own card instead of a divided row. */
  cards?: boolean;
}) {
  if (messages.length === 0)
    return <p className="text-[13px] text-ink-400">{empty}</p>;
  if (cards)
    return (
      <ul className="space-y-space-3">
        {messages.map((m) => (
          <MessageCard key={m.id} m={m} />
        ))}
      </ul>
    );
  return (
    <ul className="divide-y divide-line">
      {messages.map((m) => (
        <li key={m.id} className="py-space-2 text-[13.5px]">
          <div className="flex flex-wrap items-center gap-space-2">
            <Badge tone="clay">{MESSAGE_CHANNELS[m.channel]}</Badge>
            <Badge tone={STATUS_TONE[m.status]}>
              {m.status === "queued" && m.channel === "whatsapp"
                ? "Waiting to send"
                : STATUS_LABEL[m.status]}
            </Badge>
            {showCustomer && (
              <span className="font-semibold text-ink-900">
                {m.customer_name}
              </span>
            )}
            {m.campaign_name && (
              <span className="text-[12px] text-ink-600">
                Campaign: {m.campaign_name}
              </span>
            )}
            <span className="ml-auto text-[12px] text-ink-400">
              {new Date(m.created_at).toLocaleString("en-IN", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          {m.subject && (
            <p className="mt-1 font-medium text-ink-900">{m.subject}</p>
          )}
          <p className="mt-1 whitespace-pre-wrap text-ink-600">{m.body}</p>
          {m.error && (
            <p className="mt-1 text-[12px] text-ink-400">{m.error}</p>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Write and send (or record) one message to one customer. */
export function ComposeModal({
  customer,
  onClose,
  onSent,
}: {
  customer: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
  } | null;
  onClose: () => void;
  onSent: () => void;
}) {
  const [channel, setChannel] = useState<MessageChannel>("whatsapp");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!customer) return;
    setBusy(true);
    const res = await erp<CrmMessage>(
      `/api/v1/crm/customers/${customer.id}/messages`,
      "POST",
      {
        channel,
        subject: channel === "email" ? subject.trim() || null : null,
        body,
      },
    );
    setBusy(false);
    if (res.error) return toast.error("Couldn't send the message", res.error);
    if (res.data?.status === "sent") toast.success("Message sent");
    else if (res.data?.status === "queued")
      toast.info("Message saved", res.data.error ?? "It was not delivered.");
    else toast.error("Message failed", res.data?.error ?? "Not delivered.");
    setBody("");
    setSubject("");
    onSent();
    onClose();
  }

  return (
    <Modal
      open={customer !== null}
      onClose={onClose}
      title={`Message ${customer?.name ?? ""}`}
      description={[customer?.phone, customer?.email]
        .filter(Boolean)
        .join(" · ")}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled={busy || !body.trim()} onClick={send}>
            Send
          </Button>
        </>
      }
    >
      <Field label="Channel" htmlFor="m_channel">
        <Select
          id="m_channel"
          value={channel}
          onValueChange={(value) => setChannel(value as MessageChannel)}
        >
          {(Object.keys(MESSAGE_CHANNELS) as MessageChannel[]).map((c) => (
            <option key={c} value={c}>
              {MESSAGE_CHANNELS[c]}
            </option>
          ))}
        </Select>
      </Field>
      {channel === "email" && (
        <Field label="Subject" htmlFor="m_subject">
          <Input
            id="m_subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
        </Field>
      )}
      <Field label="Message" htmlFor="m_body">
        <textarea
          id="m_body"
          rows={5}
          className={TEXTAREA_CLASS}
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
      </Field>
    </Modal>
  );
}
