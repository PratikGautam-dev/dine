"use client";

import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, MessageCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { FormSkeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { PermissionGate } from "@/components/portal/PermissionGate";
import { WhatsAppIcon } from "@/components/portal/WhatsAppIcon";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/formatDate";
import { CustomerHeader } from "./customer-header";
import type { CustomerMessage, PatientDetail } from "@/hooks/usePatients";

/** Customers page's Communication tab -- one customer's real WhatsApp send/receive history
 * (message_log, with real message text since migration 0075; older rows before that just show a
 * generic line), plus a real "Send message" compose box. Meta only allows a free-form send to a
 * customer who messaged in the last 24 hours -- the compose box itself stays enabled either way
 * (we don't know the window client-side), but a blocked send shows the server's explanation
 * inline instead of pretending it worked. */
export function CommunicationPanel({
  profile,
  profileLoading,
  messages,
  messagesLoading,
  onLoadMessages,
  sendingMessage,
  onSendMessage,
}: {
  profile: PatientDetail | null;
  profileLoading: boolean;
  messages: CustomerMessage[] | null;
  messagesLoading: boolean;
  onLoadMessages: () => void;
  sendingMessage: boolean;
  onSendMessage: (body: string) => Promise<string | null>;
}) {
  const [draft, setDraft] = useState("");
  const [sendError, setSendError] = useState<string | null>(null);

  useEffect(() => {
    if (profile) onLoadMessages();
    setDraft("");
    setSendError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  if (profileLoading || !profile) {
    return (
      <Card className="min-h-100 p-space-4">
        <FormSkeleton fields={3} />
      </Card>
    );
  }

  async function handleSend() {
    if (!draft.trim()) return;
    setSendError(null);
    const error = await onSendMessage(draft.trim());
    if (error) setSendError(error);
    else setDraft("");
  }

  return (
    <Card className="min-h-100 p-space-4">
      <CustomerHeader profile={profile} />

      <PermissionGate page="patients" action="write">
        <div className="mb-space-4 border-b border-line pb-space-4">
          <div className="flex gap-space-2">
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Message this customer on WhatsApp…"
              className="text-[13px]"
            />
            <Button size="md" onClick={handleSend} disabled={sendingMessage || !draft.trim()}>
              <Send size={14} /> {sendingMessage ? "Sending…" : "Send"}
            </Button>
          </div>
          {sendError && <p className="mt-space-2 text-[12.5px] text-destructive">{sendError}</p>}
        </div>
      </PermissionGate>

      {messagesLoading || !messages ? (
        <TableSkeleton rows={5} columns={1} />
      ) : messages.length === 0 ? (
        <div className="flex flex-col items-center gap-space-3 rounded-lg bg-paper py-space-8 text-center">
          <MessageCircle size={26} className="text-ink-300" />
          <div>
            <p className="text-[13px] font-semibold text-ink-700">No message history yet</p>
            <p className="mx-auto mt-space-1 max-w-70 text-[12px] text-ink-400">
              WhatsApp sends and replies with this customer will show up here once they happen.
            </p>
          </div>
          <a
            href={`https://wa.me/${profile.phone.replace(/[^\d]/g, "")}`}
            target="_blank"
            rel="noreferrer"
            className="mt-space-1 inline-flex items-center gap-space-1 rounded-md bg-success px-space-3 py-space-2 text-[12.5px] font-semibold text-white hover:opacity-90"
          >
            <WhatsAppIcon size={13} className="brightness-0 invert" /> Message on WhatsApp
          </a>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {messages.map((m, i) => (
            <li key={i} className="flex items-start gap-space-3 py-space-2 text-[13px]">
              {m.direction === "outbound" ? (
                <ArrowUpRight size={14} className="mt-0.5 shrink-0 text-brand-600" />
              ) : (
                <ArrowDownLeft size={14} className="mt-0.5 shrink-0 text-success" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-ink-900">
                  {m.body || (m.direction === "outbound" ? "Sent to customer" : "Received from customer")}
                </p>
                <p className="text-[11.5px] text-ink-400">{formatDateTime(m.created_at)}</p>
              </div>
              {m.status && (
                <span
                  className={cn(
                    "shrink-0 text-[11.5px] font-semibold capitalize",
                    m.status === "failed" ? "text-destructive" : "text-ink-600",
                  )}
                >
                  {m.status}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
