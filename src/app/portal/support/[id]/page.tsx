"use client";

import { ArrowLeft, Check, LifeBuoy } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { PortalShell } from "@/components/portal/PortalShell";
import { Counter } from "@/components/portal/support/Counter";
import { Attachments } from "@/components/portal/support/Attachments";
import { PriorityBadge, StatusBadge } from "@/components/portal/support/Badges";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { ListSkeleton } from "@/components/ui/Skeleton";
import { useReplyToTicket, useSupportTicket } from "@/hooks/useSupport";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/erp/erp";
import { usePermission } from "@/lib/staffAuth";
import {
  REPLY_MAX_CHARS,
  STATUS_LABEL,
  type SupportStatus,
} from "@/lib/support";
import { toast } from "@/lib/toast";

/** The steps a ticket moves through; "waiting on you" is a pause on the way, shown as the current step when it applies. */
const STEPS: { key: SupportStatus; label: string }[] = [
  { key: "open", label: "Raised" },
  { key: "in_progress", label: "In progress" },
  { key: "completed", label: "Completed" },
];
const STEP_INDEX: Record<SupportStatus, number> = {
  open: 0,
  in_progress: 1,
  waiting_on_you: 1,
  completed: 2,
};

function Tracker({ status }: { status: SupportStatus }) {
  const at = STEP_INDEX[status];
  return (
    <ol className="flex items-center gap-space-2" aria-label="Ticket progress">
      {STEPS.map((s, i) => {
        const done = i < at || status === "completed";
        const current = i === at && status !== "completed";
        return (
          <li key={s.key} className="flex flex-1 items-center gap-space-2">
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[12px] font-bold",
                done
                  ? "bg-success text-white"
                  : current
                    ? "bg-brand-600 text-white"
                    : "bg-black/[0.06] text-ink-400",
              )}
            >
              {done ? <Check size={14} /> : i + 1}
            </span>
            <span
              className={cn(
                "text-[13px] font-semibold",
                done || current ? "text-ink-900" : "text-ink-400",
              )}
            >
              {current && status === "waiting_on_you"
                ? STATUS_LABEL.waiting_on_you
                : s.label}
            </span>
            {i < STEPS.length - 1 && (
              <span
                className={cn(
                  "h-0.5 flex-1 rounded",
                  done ? "bg-success" : "bg-black/[0.08]",
                )}
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}

export default function SupportTicketPage() {
  const { restaurant, ready } = usePortalGuard();
  const canReply = usePermission("support", "write");
  const id = useParams<{ id: string }>().id;
  const ticketQ = useSupportTicket(id);
  const reply = useReplyToTicket(id);
  const [body, setBody] = useState("");
  const t = ticketQ.data;
  if (!ready) return null;

  function send() {
    const text = body.trim();
    if (!text) return;
    reply.mutate(text, {
      onSuccess: () => {
        setBody("");
        toast.success("Reply sent");
      },
      onError: (e) => toast.error("Couldn't send the reply", e.message),
    });
  }

  return (
    <PortalShell restaurant={restaurant} active="support">
      <Link
        href="/portal/support"
        className="mb-space-3 inline-flex items-center gap-space-2 text-[13px] font-medium text-ink-600 hover:text-ink-900"
      >
        <ArrowLeft size={14} /> All tickets
      </Link>
      {ticketQ.error ? (
        <p className="text-[13px] font-medium text-error">
          {ticketQ.error.message}
        </p>
      ) : !t ? (
        <ListSkeleton rows={5} />
      ) : (
        <>
          <PageHeader
            icon={<LifeBuoy size={20} />}
            title={
              <>
                {t.subject}{" "}
                <span className="text-[16px] font-medium text-ink-400">
                  {t.ticket_number}
                </span>
              </>
            }
            description={`Raised ${formatDateTime(t.created_at)}${t.category_name ? ` · ${t.category_name}` : ""}${t.problem_reference ? ` · Ref ${t.problem_reference}` : ""}`}
            actions={
              <div className="flex items-center gap-space-2">
                <PriorityBadge priority={t.priority} />
                <StatusBadge status={t.status} />
              </div>
            }
          />

          <Card className="mb-space-4 p-space-4">
            <Tracker status={t.status} />
            {t.status === "waiting_on_you" && (
              <p className="mt-space-3 rounded-md bg-accent-violet-tint px-space-3 py-space-2 text-[13px] text-accent-violet">
                Our team has asked you something. Reply below to continue.
              </p>
            )}
            {t.resolved_at && (
              <p className="mt-space-3 text-[13px] text-ink-600">
                Completed {formatDateTime(t.resolved_at)}. If it isn&apos;t
                solved, reply below to reopen it.
              </p>
            )}
          </Card>

          <Card className="mb-space-4 p-space-4">
            <h2 className="mb-space-1 text-[13px] font-bold uppercase tracking-wide text-ink-400">
              Your question
            </h2>
            <p className="whitespace-pre-wrap break-words text-[14px] text-ink-900">
              {t.question}
            </p>
            <Attachments items={t.attachments} />
          </Card>

          <Card className="p-space-4">
            <h2 className="mb-space-3 text-[15px] font-bold text-ink-900">
              Conversation
            </h2>
            {t.messages.length === 0 ? (
              <p className="text-[13.5px] text-ink-400">
                No replies yet. We&apos;ll answer here.
              </p>
            ) : (
              <ul className="space-y-space-3">
                {t.messages.map((m) =>
                  m.kind === "status" ? (
                    <li
                      key={m.id}
                      className="text-center text-[12px] text-ink-400"
                    >
                      {m.body} · {formatDateTime(m.created_at)}
                    </li>
                  ) : (
                    <li
                      key={m.id}
                      className={cn(
                        "flex",
                        m.author_type === "business"
                          ? "justify-end"
                          : "justify-start",
                      )}
                    >
                      <div
                        className={cn(
                          "max-w-[85%] rounded-lg px-space-3 py-space-2",
                          m.author_type === "business"
                            ? "bg-brand-50"
                            : "border border-line bg-card",
                        )}
                      >
                        <p className="text-[12px] font-semibold text-ink-600">
                          {m.author_name} · {formatDateTime(m.created_at)}
                        </p>
                        <p className="whitespace-pre-wrap break-words text-[14px] text-ink-900">
                          {m.body}
                        </p>
                      </div>
                    </li>
                  ),
                )}
              </ul>
            )}

            {canReply && (
              <div className="mt-space-4 border-t border-line pt-space-3">
                <Textarea
                  rows={3}
                  maxLength={REPLY_MAX_CHARS}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder={
                    t.status === "completed"
                      ? "Still not solved? Reply to reopen this ticket."
                      : "Write a reply…"
                  }
                />
                <Counter
                  used={body.length}
                  max={REPLY_MAX_CHARS}
                  unit="characters"
                />
                <div className="mt-space-2 flex justify-end">
                  <Button
                    disabled={!body.trim() || reply.isPending}
                    onClick={send}
                  >
                    {reply.isPending
                      ? "Sending…"
                      : t.status === "completed"
                        ? "Reopen with reply"
                        : "Send reply"}
                  </Button>
                </div>
              </div>
            )}
          </Card>
        </>
      )}
    </PortalShell>
  );
}
