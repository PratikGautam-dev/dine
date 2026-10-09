"use client";

import { useEffect } from "react";
import { ArrowDownLeft, ArrowUpRight, MessageCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { FormSkeleton, TableSkeleton } from "@/components/ui/Skeleton";
import { WhatsAppIcon } from "@/components/portal/WhatsAppIcon";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/formatDate";
import { CustomerHeader } from "./customer-header";
import type { CustomerMessage, PatientDetail } from "@/hooks/usePatients";

/** Customers page's Communication tab -- one customer's real WhatsApp send/receive history
 * (message_log.phone, added this session; only covers activity since then, older rows have no
 * phone recorded). */
export function CommunicationPanel({
  profile,
  profileLoading,
  messages,
  messagesLoading,
  onLoadMessages,
}: {
  profile: PatientDetail | null;
  profileLoading: boolean;
  messages: CustomerMessage[] | null;
  messagesLoading: boolean;
  onLoadMessages: () => void;
}) {
  useEffect(() => {
    if (profile) onLoadMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id]);

  if (profileLoading || !profile) {
    return (
      <Card className="min-h-100 p-space-4">
        <FormSkeleton fields={3} />
      </Card>
    );
  }

  return (
    <Card className="min-h-100 p-space-4">
      <CustomerHeader profile={profile} />

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
            <li key={i} className="flex items-center gap-space-3 py-space-2 text-[13px]">
              {m.direction === "outbound" ? (
                <ArrowUpRight size={14} className="shrink-0 text-brand-600" />
              ) : (
                <ArrowDownLeft size={14} className="shrink-0 text-success" />
              )}
              <span className="flex-1 font-semibold text-ink-900">
                {m.direction === "outbound" ? "Sent to customer" : "Received from customer"}
              </span>
              {m.status && (
                <span
                  className={cn(
                    "text-[11.5px] font-semibold capitalize",
                    m.status === "failed" ? "text-destructive" : "text-ink-600",
                  )}
                >
                  {m.status}
                </span>
              )}
              <span className="text-[11.5px] text-ink-400">{formatDateTime(m.created_at)}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
