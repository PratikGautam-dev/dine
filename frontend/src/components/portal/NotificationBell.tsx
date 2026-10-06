"use client";

import { Bell } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { portalFetch } from "@/lib/portalAuth";
import { rupees } from "@/lib/foodOrders";
import { staffJson } from "@/lib/hr";
import { hasPermission, useStaffSession } from "@/lib/staffAuth";

type Notice = { id: number; kind: string; title: string; body: string | null; link: string | null; is_read: boolean; created_at: string };
type OrderItem = { id: number; reference_id: string | null; patient_name: string | null; phone: string; total_paise: number; status: string };

const POLL_MS = 15_000;
const LAST_SEEN_ORDER_KEY = "bell_last_seen_order_id";

function readLastSeen(): number | null {
  try {
    const raw = localStorage.getItem(LAST_SEEN_ORDER_KEY);
    return raw === null ? null : Number(raw);
  } catch {
    return null;
  }
}

function writeLastSeen(id: number) {
  try {
    localStorage.setItem(LAST_SEEN_ORDER_KEY, String(id));
  } catch {
    // Storage can be blocked; the unread count then just resets on reload.
  }
}

/** Header bell: new orders (from the orders list, unread until the panel is opened) plus the
 * leave notices the staff notifications feed sends. */
export function NotificationBell() {
  const session = useStaffSession();
  const canLeave = session !== null && hasPermission(session, "my_leave", "view");
  const canOrders = session !== null && hasPermission(session, "food_orders", "view");
  const allowed = canLeave || canOrders;
  const [notices, setNotices] = useState<Notice[]>([]);
  const [unread, setUnread] = useState(0);
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [orderUnread, setOrderUnread] = useState(0);
  const [open, setOpen] = useState(false);

  const loadNotices = useCallback(async () => {
    const { data } = await staffJson<{ notifications: Notice[]; unread: number }>("/api/portal/notifications");
    if (data) {
      setNotices(data.notifications);
      setUnread(data.unread);
    }
  }, []);

  const loadOrders = useCallback(async () => {
    if (!canOrders) return;
    const result = await portalFetch("/api/portal/food-orders?days=1");
    if (!result.ok) return;
    const list = (result.data as { food_orders: OrderItem[] }).food_orders
      .filter((o) => o.status !== "cancelled")
      .slice(0, 20);
    setOrders(list);
    const lastSeen = readLastSeen();
    if (lastSeen === null) {
      if (list.length) writeLastSeen(Math.max(...list.map((o) => o.id)));
      setOrderUnread(0);
      return;
    }
    setOrderUnread(list.filter((o) => o.id > lastSeen).length);
  }, [canOrders]);

  useEffect(() => {
    if (!allowed) return;
    const refresh = () => {
      if (canLeave) loadNotices();
      loadOrders();
    };
    const first = setTimeout(refresh, 0);
    const timer = setInterval(refresh, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [allowed, canLeave, loadNotices, loadOrders]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (!next) return;
    if (canLeave) {
      await loadNotices();
      if (unread > 0) {
        const { data } = await staffJson<{ unread: number }>("/api/portal/notifications/read", "POST", {});
        if (data) setUnread(data.unread);
      }
    }
    if (orders.length) writeLastSeen(Math.max(...orders.map((o) => o.id)));
    setOrderUnread(0);
  }

  if (!allowed) return null;

  const totalUnread = unread + orderUnread;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={totalUnread > 0 ? `Notifications, ${totalUnread} unread` : "Notifications"}
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-md text-ink-600 hover:bg-paper"
      >
        <Bell size={18} strokeWidth={2} />
        {totalUnread > 0 && (
          <span data-testid="notification-count" className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 text-[10px] font-bold text-white">
            {totalUnread > 9 ? "9+" : totalUnread}
          </span>
        )}
      </button>
      {open && (
        <div role="dialog" aria-label="Notifications" className="absolute right-0 z-40 mt-1 w-80 max-w-[90vw] rounded-lg border border-line bg-card shadow-[var(--shadow-lg)]">
          <p className="border-b border-line px-space-4 py-space-3 text-[13px] font-bold text-ink-900">Notifications</p>
          {orders.length === 0 && notices.length === 0 ? (
            <p className="px-space-4 py-space-5 text-[13px] text-ink-400">Nothing yet.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-line overflow-y-auto">
              {orders.map((o) => (
                <li key={`order-${o.id}`} className="px-space-4 py-space-3">
                  <Link href="/portal/food-orders" onClick={() => setOpen(false)}>
                    <p className="text-[13px] font-semibold text-ink-900">
                      Order {o.reference_id ?? `#${o.id}`} · {o.patient_name || o.phone}
                    </p>
                    <p className="mt-0.5 text-[12px] text-ink-600">{rupees(o.total_paise)} · {o.status.replace(/_/g, " ")}</p>
                  </Link>
                </li>
              ))}
              {notices.map((n) => {
                const inner = (
                  <>
                    <p className={cn("text-[13px] text-ink-900", !n.is_read && "font-semibold")}>{n.title}</p>
                    {n.body && <p className="mt-0.5 text-[12px] text-ink-600">{n.body}</p>}
                  </>
                );
                return (
                  <li key={`notice-${n.id}`} className="px-space-4 py-space-3">
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
