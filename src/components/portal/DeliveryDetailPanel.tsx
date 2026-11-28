"use client";

import { type ReactNode, useState } from "react";
import {
  Bike,
  Check,
  Clock,
  LocateFixed,
  MapPin,
  Minus,
  Navigation,
  Plus,
  MoreVertical,
  Package,
  Phone,
  Receipt,
  User,
  UserCog,
  XCircle,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { WhatsAppIcon } from "@/components/portal/WhatsAppIcon";
import { type FoodOrder, orderStatusLabel, useFoodOrderDetail } from "@/hooks/useFoodOrders";
import { cn } from "@/lib/cn";
import { parseOrderTime, rupees } from "@/lib/foodOrders";

const STEPS = ["Order Placed", "Confirmed", "Preparing", "Out for Delivery", "Delivered"];
// How far along each status is (index into STEPS); a delivery that has not been handed over yet sits at "Preparing"
const RANK: Record<string, number> = {
  pending_payment: -1,
  placed: 0,
  paid: 0,
  accepted: 1,
  preparing: 2,
  ready_for_pickup: 2,
  out_for_delivery: 3,
  completed: 4,
};

export function clock(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = parseOrderTime(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

export function minutesBetween(from: string, to: string): number {
  return Math.max(
    0,
    Math.round((parseOrderTime(to).getTime() - parseOrderTime(from).getTime()) / 60000),
  );
}

/** "42 min", "3h 5m", "5d 4h": minutes in the unit a person reads. */
export function duration(min: number): string {
  if (min < 60) return `${min} min`;
  if (min < 1440) return `${Math.floor(min / 60)}h ${min % 60}m`;
  return `${Math.floor(min / 1440)}d ${Math.floor((min % 1440) / 60)}h`;
}

/** The rounded status pill used on the list rows and the panel header. */
export function StatusPill({ status }: { status: string }) {
  const live = status === "out_for_delivery";
  const done = status === "completed";
  const off = status === "cancelled";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-space-2 py-0.5 text-[11px] font-bold whitespace-nowrap",
        live && "bg-brand-600 text-white",
        done && "bg-success-tint text-success",
        off && "bg-black/[0.05] text-ink-600",
        !live && !done && !off && "bg-info-tint text-info",
      )}
    >
      {live ? (
        <Bike size={11} />
      ) : done ? (
        <Check size={11} />
      ) : off ? (
        <XCircle size={11} />
      ) : (
        <Clock size={11} />
      )}
      {orderStatusLabel({ status, fulfillment_type: "delivery" })}
    </span>
  );
}

function phoneDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

/** "+919687432109" -> "+91 96874 32109"; anything else is shown as typed. */
function prettyPhone(raw: string): string {
  const m = raw.replace(/[\s().-]/g, "").match(/^\+?91(\d{5})(\d{5})$/);
  return m ? `+91 ${m[1]} ${m[2]}` : raw;
}

/** Call and WhatsApp as two labelled buttons side by side, for cards too narrow to fit them beside a name. */
function ContactActions({ phone }: { phone: string }) {
  const digits = phoneDigits(phone);
  return (
    <div className="mt-space-2 grid grid-cols-2 gap-space-2">
      <a
        href={`tel:${phone}`}
        className="flex h-8 items-center justify-center gap-1.5 rounded-lg bg-info-tint text-[12.5px] font-semibold text-info hover:brightness-95"
      >
        <Phone size={14} /> Call
      </a>
      <a
        href={`https://wa.me/${digits}`}
        target="_blank"
        rel="noreferrer"
        className="flex h-8 items-center justify-center gap-1.5 rounded-lg bg-success-tint text-[12.5px] font-semibold text-success hover:brightness-95"
      >
        <WhatsAppIcon size={14} /> WhatsApp
      </a>
    </div>
  );
}

function SideCard({
  title,
  icon,
  children,
}: {
  title: ReactNode;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card className="px-space-3 py-space-2">
      <h4 className="mb-1.5 flex items-center gap-space-2 text-[13px] font-bold text-ink-900">
        <span className="text-brand-600">{icon}</span>
        {title}
      </h4>
      {children}
    </Card>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-space-3 py-0.5 text-[12.5px]">
      <span className="text-ink-600">{label}</span>
      <span className="text-right font-semibold text-ink-900">{value}</span>
    </div>
  );
}

const MAP_ZOOM_DEFAULT = 15;

function MapButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="flex h-6 w-6 items-center justify-center bg-card text-ink-900 hover:bg-paper"
    >
      {children}
    </button>
  );
}

function MapCard({ address }: { address: string | null }) {
  // Google's own controls can't be restyled inside the embed, so the zoom, recentre and open buttons are ours: zooming reloads the embed
  // at a new zoom level. The embed's top bar is pushed out of view; its attribution along the bottom is left alone.
  const [zoom, setZoom] = useState(MAP_ZOOM_DEFAULT);
  const [nonce, setNonce] = useState(0);
  const openUrl = address
    ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`
    : null;
  return (
    <Card className="overflow-hidden p-0">
      <div className="relative h-[300px] overflow-hidden bg-paper">
        {address ? (
          <>
            <iframe
              key={`${zoom}-${nonce}`}
              title="Delivery address map"
              src={`https://www.google.com/maps?q=${encodeURIComponent(address)}&z=${zoom}&output=embed`}
              loading="lazy"
              referrerPolicy="no-referrer"
              tabIndex={-1}
              className="pointer-events-none absolute inset-x-0 bottom-0 h-[calc(100%+210px)] w-full border-0"
            />
            {openUrl && (
              <a
                href={openUrl}
                target="_blank"
                rel="noreferrer"
                aria-label="Open in Google Maps"
                title="Open in Google Maps"
                className="absolute top-space-2 right-space-2 flex h-8 w-8 items-center justify-center rounded-full bg-card text-brand-600 shadow-md hover:bg-paper"
              >
                <Navigation size={15} />
              </a>
            )}
            <div className="absolute right-1 bottom-5 flex flex-col divide-y divide-line overflow-hidden rounded-md border border-line bg-card p-1 shadow-md">
              <MapButton label="Zoom in" onClick={() => setZoom((z) => Math.min(19, z + 1))}>
                <Plus size={12} />
              </MapButton>
              <MapButton label="Zoom out" onClick={() => setZoom((z) => Math.max(3, z - 1))}>
                <Minus size={12} />
              </MapButton>
              <MapButton
                label="Centre on the address"
                onClick={() => {
                  setZoom(MAP_ZOOM_DEFAULT);
                  setNonce((n) => n + 1);
                }}
              >
                <LocateFixed size={12} />
              </MapButton>
            </div>
          </>
        ) : (
          <div
            className="flex h-full flex-col items-center justify-center gap-space-2 px-space-4 text-center"
            style={{
              backgroundImage:
                "linear-gradient(var(--color-line) 1px, transparent 1px), linear-gradient(90deg, var(--color-line) 1px, transparent 1px)",
              backgroundSize: "36px 36px",
            }}
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-600 text-white shadow-md">
              <MapPin size={20} />
            </span>
            <p className="max-w-[320px] rounded-md bg-card/90 px-space-2 py-1 text-[12.5px] font-semibold text-ink-900">
              No address on this order.
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}

/** The right-hand side of Delivery Tracking: one delivery order's progress, map, items, customer, partner and delivery facts. */
export function DeliveryDetailPanel({
  order,
  canWrite,
  busy,
  onAssign,
  onDelivered,
}: {
  order: FoodOrder;
  canWrite: boolean;
  busy: boolean;
  onAssign: () => void;
  onDelivered: () => void;
}) {
  const { detail } = useFoodOrderDetail(order.id);
  const [menuOpen, setMenuOpen] = useState(false);
  const history = detail?.status_history ?? [];
  const reachedAt = (to: string) => history.find((h) => h.to_status === to)?.created_at ?? null;

  const cancelled = order.status === "cancelled";
  const rank = RANK[order.status] ?? 0;
  const stepTime = [
    order.created_at,
    reachedAt("accepted"),
    reachedAt("preparing"),
    reachedAt("out_for_delivery") ?? order.dispatched_at ?? null,
    order.status === "completed" ? (reachedAt("completed") ?? order.updated_at) : null,
  ];
  const live = order.status === "out_for_delivery";
  const dispatchedAt = order.dispatched_at ?? reachedAt("out_for_delivery");
  const address = order.delivery_address?.trim() || null;
  const sourceLabel = order.source === "website" ? "Website" : "WhatsApp";
  const partnerName = order.delivery_partner_name;
  const customerInitials =
    (order.patient_name || "Guest")
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "G";
  const initials = (partnerName || "?")
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Card className="p-space-4" data-testid="delivery-detail">
      <div className="mb-space-4 flex flex-wrap items-start justify-between gap-space-3">
        <div className="flex min-w-0 items-center gap-space-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <Bike size={22} />
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-space-2">
              <h3 className="text-[18px] font-bold text-ink-900">
                Order {order.reference_id ?? `#${order.id}`}
              </h3>
              <StatusPill status={order.status} />
            </div>
            <p className="text-[12.5px] text-ink-600">
              Source: {sourceLabel} <span className="px-1 text-ink-400">|</span> Placed at{" "}
              {clock(order.created_at)}
            </p>
          </div>
        </div>
        {canWrite && live && (
          <div className="relative flex items-center gap-space-2">
            <button
              type="button"
              onClick={onAssign}
              className="flex items-center gap-1.5 rounded-md bg-brand-50 px-space-3 py-2 text-[12.5px] font-semibold text-brand-700 hover:bg-brand-100"
            >
              <UserCog size={14} /> Assign / Reassign
            </button>
            <button
              type="button"
              aria-label="More actions"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((o) => !o)}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-line text-brand-700 hover:bg-paper"
            >
              <MoreVertical size={16} />
            </button>
            {menuOpen && (
              <div className="absolute top-11 right-0 z-20 w-44 rounded-md border border-line bg-card p-1 shadow-[var(--shadow-md)]">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setMenuOpen(false);
                    onDelivered();
                  }}
                  className="w-full rounded px-space-2 py-2 text-left text-[13px] font-semibold text-ink-900 hover:bg-paper disabled:opacity-50"
                >
                  {busy ? "…" : "Mark delivered"}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {cancelled && (
        <p className="mb-space-4 flex items-center gap-space-2 rounded-md bg-destructive-tint/40 px-space-3 py-space-2 text-[13px] font-semibold text-destructive">
          <XCircle size={15} /> This order was cancelled.
        </p>
      )}

      <ol className="mb-space-4 grid grid-cols-5 gap-space-1">
        {STEPS.map((label, i) => {
          const done = !cancelled && (i < rank || rank === 4);
          const current = !cancelled && i === rank && rank !== 4;
          const reached = cancelled ? Boolean(stepTime[i]) : done || current;
          return (
            <li key={label} className="relative flex flex-col items-center text-center">
              {i > 0 && (
                <span
                  aria-hidden
                  className={cn(
                    "absolute top-3.5 right-1/2 h-0.5 w-full",
                    reached ? (current ? "bg-brand-600" : "bg-success") : "bg-line",
                  )}
                />
              )}
              <span
                className={cn(
                  "relative z-10 flex h-7 w-7 items-center justify-center rounded-full text-white",
                  current
                    ? "bg-brand-600 ring-4 ring-brand-100"
                    : reached
                      ? "bg-success"
                      : "bg-line",
                )}
              >
                {current ? <Bike size={14} /> : reached ? <Check size={14} /> : null}
              </span>
              <span
                className={cn(
                  "mt-space-1 text-[11.5px] leading-tight font-semibold",
                  reached ? "text-ink-900" : "text-ink-400",
                )}
              >
                {label}
              </span>
              <span className="text-[11px] text-ink-400">{reached ? clock(stepTime[i]) : ""}</span>
            </li>
          );
        })}
      </ol>

      <div className="grid gap-space-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,260px)]">
        <div className="space-y-space-3">
          <MapCard address={address} />

          <Card className="p-space-3">
            <div className="mb-space-2 flex items-center justify-between gap-space-2">
              <h4 className="flex items-center gap-space-2 text-[13px] font-bold text-ink-900">
                <span className="text-brand-600">
                  <Package size={15} />
                </span>
                Order Items ({(order.items ?? []).reduce((n, l) => n + l.quantity, 0)})
              </h4>
              <span className="text-[13px] font-bold text-ink-900">
                Total: {rupees(order.total_paise)}
              </span>
            </div>
            {(order.items ?? []).length === 0 ? (
              <p className="text-[12.5px] text-ink-400">No items to show.</p>
            ) : (
              <ul className="divide-y divide-line rounded-md border border-line px-space-3 text-[13px]">
                {(order.items ?? []).map((l) => (
                  <li
                    key={l.menu_item_id}
                    className="flex items-center justify-between gap-space-3 py-2"
                  >
                    <span className="text-ink-900">
                      {l.quantity} × {l.item_name_snapshot}
                    </span>
                    <span className="tabular-nums text-ink-900">
                      {rupees(l.unit_price_paise_snapshot * l.quantity)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-space-3">
          <SideCard title="Customer Details" icon={<User size={15} />}>
            <div className="flex items-center gap-space-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[12px] font-bold text-brand-700">
                {customerInitials}
              </span>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold text-ink-900">
                  {order.patient_name || "Guest"}
                </p>
                <p className="text-[12px] whitespace-nowrap text-ink-600">
                  {prettyPhone(order.phone)}
                </p>
              </div>
            </div>
            <ContactActions phone={order.phone} />
            <div className="mt-space-2 border-t border-line pt-1.5">
              <div className="flex items-start gap-space-2 text-[12.5px] text-ink-600">
                <MapPin size={14} className="mt-0.5 shrink-0 text-ink-400" />
                <span>{address ?? "No address on this order."}</span>
              </div>
              {address && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-flex items-center gap-1 rounded-full bg-brand-50 px-space-2 py-0.5 text-[11px] font-semibold text-brand-700 hover:bg-brand-100"
                >
                  <MapPin size={10} /> View on Map
                </a>
              )}
            </div>
          </SideCard>

          <SideCard
            title={
              <>
                Delivery Partner <span className="text-brand-600">(DAAP)</span>
              </>
            }
            icon={<Bike size={15} />}
          >
            {partnerName || order.delivery_partner_phone ? (
              <>
                <div className="flex items-center gap-space-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-[12px] font-bold text-brand-700">
                    {initials}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-ink-900">
                      {partnerName || "Name not recorded"}
                    </p>
                    <p className="text-[12px] whitespace-nowrap text-ink-600">
                      {order.delivery_partner_phone
                        ? prettyPhone(order.delivery_partner_phone)
                        : "No number"}
                    </p>
                  </div>
                </div>
                {order.delivery_partner_phone && (
                  <ContactActions phone={order.delivery_partner_phone} />
                )}
                <div className="mt-space-2 border-t border-line pt-1.5">
                  <Row label="Tracking ID" value={order.delivery_tracking_id || "—"} />
                </div>
              </>
            ) : (
              <p className="text-[12.5px] text-ink-400">DAAP Delivery · no rider assigned yet.</p>
            )}
          </SideCard>

          <SideCard title="Delivery Info" icon={<Receipt size={15} />}>
            <Row label="Assigned At" value={dispatchedAt ? clock(dispatchedAt) : "—"} />
            <Row
              label={order.status === "completed" ? "Delivered in" : "On the road"}
              value={
                dispatchedAt
                  ? duration(
                      minutesBetween(
                        dispatchedAt,
                        order.status === "completed" ? order.updated_at : new Date().toISOString(),
                      ),
                    )
                  : "—"
              }
            />
            <Row
              label="Payment"
              value={order.payment_method === "online" ? "Paid online" : "Pay on delivery"}
            />
            <Row label="Delivery fee" value={rupees(order.delivery_fee_paise ?? 0)} />
          </SideCard>
        </div>
      </div>
    </Card>
  );
}
