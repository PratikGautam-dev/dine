"use client";

import { useEffect, useState } from "react";
import { Check, ClipboardList } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { PermissionGate } from "@/components/portal/PermissionGate";
import { WhatsAppIcon } from "@/components/portal/WhatsAppIcon";
import { formatDate } from "@/lib/formatDate";
import type { OpenFollowUp } from "@/hooks/useCustomerNotes";

/** Customers page's Follow-ups tab -- every open (not-yet-done) note with a follow-up date,
 * across every customer, soonest due first. Clicking a customer's name opens their own Notes tab
 * so staff can mark it done (or add context) in one place, same "jump to the real record" pattern
 * the Segments/Tags member drill-downs already use. */
export function FollowUpsPanel({
  followUps,
  loading,
  onLoad,
  onMarkDone,
  onSelectCustomer,
}: {
  followUps: OpenFollowUp[] | null;
  loading: boolean;
  onLoad: () => void;
  onMarkDone: (noteId: number) => void;
  onSelectCustomer: (id: number) => void;
}) {
  useEffect(() => {
    onLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Snapshotted once the list has loaded, not Date.now() called inline during render (an impure
  // call React's purity rule flags) -- same treatment useCustomerDetail.ts's own upcoming/past
  // split gives "now" for a page that isn't left open for hours anyway.
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (followUps) setNow(Date.now());
  }, [followUps]);

  return (
    <Card className="p-space-4">
      <h3 className="text-label mb-space-3 font-bold text-ink-900">Open follow-ups</h3>
      {loading || !followUps ? (
        <TableSkeleton rows={5} columns={1} />
      ) : followUps.length === 0 ? (
        <div className="flex flex-col items-center gap-space-2 rounded-lg bg-paper py-space-8 text-center">
          <ClipboardList size={22} className="text-ink-300" />
          <p className="text-[13px] font-semibold text-ink-700">Nothing due</p>
          <p className="text-[12px] text-ink-400">
            Follow-ups you add from a customer&apos;s Notes tab show up here.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-line">
          {followUps.map((f) => {
            const overdue = now !== null && new Date(f.follow_up_at!).getTime() < now;
            return (
              <li key={f.id} className="flex items-start justify-between gap-space-3 py-space-3">
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => onSelectCustomer(f.patient_id)}
                    className="text-[13.5px] font-semibold text-brand-600 hover:underline"
                  >
                    {f.patient_name || "Not registered yet"}
                  </button>
                  <p className="flex items-center gap-1 text-[12px] text-ink-600">
                    <WhatsAppIcon size={11} /> {f.patient_phone}
                  </p>
                  <p className="mt-space-1 truncate text-[12.5px] text-ink-700">{f.body}</p>
                </div>
                <div className="flex shrink-0 items-center gap-space-2">
                  <Badge tone={overdue ? "clay" : "warning"}>
                    {overdue ? "Overdue" : "Due"} {formatDate(f.follow_up_at)}
                  </Badge>
                  <PermissionGate page="customers" action="write">
                    <button
                      type="button"
                      onClick={() => onMarkDone(f.id)}
                      aria-label="Mark done"
                      className="rounded-md p-1 text-ink-400 hover:bg-black/[0.04] hover:text-success"
                    >
                      <Check size={16} />
                    </button>
                  </PermissionGate>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
