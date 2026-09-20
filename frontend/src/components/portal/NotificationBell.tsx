"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { staffJson } from "@/lib/hr";
import { hasPermission, useStaffSession } from "@/lib/staffAuth";

type Notice = { id: number; kind: string; title: string; body: string | null; link: string | null; is_read: boolean; created_at: string };

const POLL_MS = 60_000;

/** The in-portal notification bell: a count of unread notices and a panel listing the latest. Opening the
 * panel marks them read. Only shown to people who can use My Leave (everyone by default). */
export function NotificationBell() {
  const session = useStaffSession();
  const allowed = hasPermission(session, "my_leave", "view") && session !== null;
  const [notices, setNotices] = useState<Notice[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const { data } = await staffJson<{ notifications: Notice[]; unread: number }>("/api/portal/notifications");
    if (data) {
      setNotices(data.notifications);
      setUnread(data.unread);
    }
  }, []);

  useEffect(() => {
    if (!allowed) return;
    const first = setTimeout(load, 0);
    const timer = setInterval(load, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [allowed, load]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      await load();
      if (unread > 0) {
        const { data } = await staffJson<{ unread: number }>("/api/portal/notifications/read", "POST", {});
        if (data) setUnread(data.unread);
      }
    }
  }

  if (!allowed) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-md text-ink-600 hover:bg-paper"
      >
        <Bell size={18} strokeWidth={2} />
        {unread > 0 && (
          <span data-testid="notification-count" className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div role="dialog" aria-label="Notifications" className="absolute right-0 z-40 mt-1 w-80 max-w-[90vw] rounded-lg border border-line bg-card shadow-[var(--shadow-lg)]">
          <p className="border-b border-line px-space-4 py-space-3 text-[13px] font-bold text-ink-900">Notifications</p>
          {notices.length === 0 ? (
            <p className="px-space-4 py-space-5 text-[13px] text-ink-400">Nothing yet.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-line overflow-y-auto">
              {notices.map((n) => {
                const inner = (
                  <>
                    <p className={cn("text-[13px] text-ink-900", !n.is_read && "font-semibold")}>{n.title}</p>
                    {n.body && <p className="mt-0.5 text-[12px] text-ink-600">{n.body}</p>}
                  </>
                );
                return (
                  <li key={n.id} className="px-space-4 py-space-3">
                    {n.link ? <Link href={n.link} onClick={() => setOpen(false)}>{inner}</Link> : inner}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
