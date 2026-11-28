"use client";

import {
  Bike,
  CalendarCheck,
  CalendarClock,
  ChefHat,
  Megaphone,
  MessageSquare,
  Star,
  ToggleRight,
  UtensilsCrossed,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { SettingsPageFrame } from "@/components/portal/settings/SettingsPageFrame";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { Badge } from "@/components/erp-ui/Badge";
import { Card } from "@/components/erp-ui/Card";
import { ConfirmDialog } from "@/components/erp-ui/ConfirmDialog";
import { SkeletonLines } from "@/components/erp-ui/Skeleton";
import { Switch } from "@/components/erp-ui/Switch";
import {
  useModules,
  useSwitchModule,
  type ModuleKey,
  type OptionalModule,
} from "@/hooks/useModules";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/erp/erp";
import { usePermission } from "@/lib/staffAuth";
import { toast } from "@/lib/toast";

const INFO: Record<ModuleKey, { icon: React.ReactNode; adds: string; off: string }> = {
  dining: {
    icon: <UtensilsCrossed size={20} />,
    adds: "Table bookings, kitchen orders and delivery tracking under one switch, in the portal. Each also has its own switch below.",
    off: "Table Bookings, Tables, Kitchen Orders and Delivery Tracking disappear from the portal. Orders and bookings are still taken, and each module keeps its own switch for when Dining operations is back on.",
  },
  table_bookings: {
    icon: <CalendarCheck size={18} />,
    adds: "Guests book a table online or by WhatsApp; your team sees the day's bookings and the floor map. Adds Table Bookings and Tables to the portal.",
    off: "The Table Bookings and Tables pages disappear from the portal.",
  },
  kitchen: {
    icon: <ChefHat size={18} />,
    adds: "The kitchen's live order board: new orders, preparing, ready. Adds Kitchen Orders to the portal.",
    off: "The Kitchen Orders page disappears from the portal. Food orders still come in and can be managed from Food Orders.",
  },
  delivery: {
    icon: <Bike size={18} />,
    adds: "Dispatch orders to riders and follow each delivery until it arrives. Adds Delivery Tracking to the portal.",
    off: "The Delivery Tracking page disappears from the portal.",
  },
  marketing: {
    icon: <Megaphone size={20} />,
    adds: "Offers and coupons, WhatsApp campaigns, and customer membership, tags and segments. Adds Offers, Campaigns, Membership, Tags and Segments to the portal.",
    off: "Offers, Campaigns, Membership, Tags and Segments disappear from the portal. Your customer list stays, and running offers still apply at checkout.",
  },
  messaging: {
    icon: <MessageSquare size={20} />,
    adds: "The WhatsApp inbox where staff reply to guests, and the automated messages and reminders you send. Adds WhatsApp Inbox and Messages & Automations to the portal.",
    off: "WhatsApp Inbox and Messages & Automations disappear from the portal. Guests can still message you and automations keep running.",
  },
  feedback: {
    icon: <Star size={20} />,
    adds: "Ratings and reviews from your guests, with replies. Adds Feedback to the portal.",
    off: "The Feedback page disappears from the portal. Reviews are still collected and shown on your storefront.",
  },
  workforce: {
    icon: <CalendarClock size={20} />,
    adds: "Attendance with check-in and check-out, breaks, leave requests and approvals, holidays and team attendance, as one package. Adds the Workforce menu and Settings > Attendance and holidays.",
    off: "The whole Workforce menu (attendance, check-in, leave, holidays) disappears for everyone.",
  },
};

/** Settings > Modules: the business switches its optional modules on and off, for the portal and its tills alike (the till has no
 * switches of its own). Dining operations is one switch over its three modules, each with its own switch too. Dine Connect can disable a module
 * for the business; then the switch is locked and says to contact support. A module with open work can't be switched off (the server
 * refuses it too). */
export default function ModulesSettingsPage() {
  const { restaurant, ready } = usePortalGuard();
  const canEdit = usePermission("settings", "write");
  const modules = useModules();
  const toggle = useSwitchModule();
  const [confirm, setConfirm] = useState<OptionalModule | null>(null);
  if (!ready) return null;
  const currency = "INR";
  const all = modules.data ?? [];
  const dining = all.find((m) => m.key === "dining");
  const children = all.filter((m) => m.parent === "dining");
  const standalone = all.filter((m) => !m.parent && m.key !== "dining");

  const apply = (m: OptionalModule, enabled: boolean) =>
    toggle.mutate(
      { key: m.key, enabled },
      {
        onSuccess: () => {
          toast.success(`${m.label} switched ${enabled ? "on" : "off"}`);
          setConfirm(null);
        },
        onError: (e) => {
          toast.error(`Couldn't switch ${m.label} ${enabled ? "on" : "off"}`, e.message);
          setConfirm(null);
        },
      },
    );

  const row = (m: OptionalModule, nested = false) => (
    <ModuleRow
      key={m.key}
      module={m}
      nested={nested}
      canEdit={canEdit}
      pending={toggle.isPending}
      currency={currency}
      onToggle={() => (m.enabled ? setConfirm(m) : apply(m, true))}
    />
  );

  return (
    <SettingsPageFrame
      restaurant={restaurant}
      maxWidthClass="max-w-3xl"
      icon={<ToggleRight size={20} />}
      title="Modules"
      description="Switch on only what your business uses, here for the portal and your tills alike. Switching a module off hides it for everyone and deletes nothing: switch it back on and everything is as you left it."
    >
      {modules.error && (
        <p className="mb-space-3 text-[13px] font-medium text-error">{modules.error.message}</p>
      )}
      <div className="grid gap-space-4">
        {!modules.data ? (
          <Card className="p-space-5">
            <SkeletonLines rows={6} />
          </Card>
        ) : (
          <>
            {dining && (
              <Card className="p-space-5">
                {row(dining)}
                <div className="mt-space-4 divide-y divide-line border-t border-line">
                  {children.map((m) => row(m, true))}
                </div>
              </Card>
            )}
            {standalone.map((m) => (
              <Card key={m.key} className="p-space-5">
                {row(m)}
              </Card>
            ))}
          </>
        )}
      </div>
      <ConfirmDialog
        open={confirm !== null}
        title={`Switch off ${confirm?.label ?? ""}?`}
        message={
          confirm
            ? `${INFO[confirm.key].off} Nothing is deleted: switch it back on and everything is as you left it.`
            : ""
        }
        confirmLabel="Switch off"
        destructive
        busy={toggle.isPending}
        onConfirm={() => confirm && apply(confirm, false)}
        onCancel={() => setConfirm(null)}
      />
    </SettingsPageFrame>
  );
}

/** One module with its badge, what it adds, why it is off and its switch. A nested row is a Dining operations module: while Dining operations is off it
 * says so, and its own switch can still be changed (it applies when Dining operations is back on). */
function ModuleRow({
  module: m,
  nested,
  canEdit,
  pending,
  currency,
  onToggle,
}: {
  module: OptionalModule;
  nested: boolean;
  canEdit: boolean;
  pending: boolean;
  currency: string;
  onToggle: () => void;
}) {
  const blocked = !m.allowed;
  const busy = m.enabled && m.open_work.length > 0;
  const locked = !canEdit || blocked || busy || pending;
  return (
    <div className={cn("flex items-start gap-space-4", nested && "py-space-4 last:pb-0")}>
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-600",
          nested ? "h-8 w-8" : "h-10 w-10",
        )}
      >
        {INFO[m.key].icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-space-2">
          <h2 className={cn("font-bold text-ink-900", nested ? "text-[14px]" : "text-[15px]")}>
            {m.label}
          </h2>
          {blocked ? (
            <Badge tone="error">Disabled by Dine Connect</Badge>
          ) : m.active ? (
            <Badge tone="success">On</Badge>
          ) : m.reason === "parent" ? (
            <Badge tone="neutral">Off with Dining operations</Badge>
          ) : (
            <Badge tone="neutral">Off</Badge>
          )}
        </div>
        <p className="mt-1 text-[13px] text-ink-600">{INFO[m.key].adds}</p>
        {blocked && (
          <p className="mt-space-2 text-[13px] font-medium text-error">
            This module has been disabled for your business. Please{" "}
            <Link href="/portal/support" className="underline hover:no-underline">
              contact support
            </Link>{" "}
            to turn it back on.
          </p>
        )}
        {!blocked && m.reason === "parent" && (
          <p className="mt-space-2 text-[12.5px] text-ink-400">
            Dining operations is off, so this is off too. Its own switch is kept for when Dining
            operations is back on.
          </p>
        )}
        {m.open_work.length > 0 && (
          <div className="mt-space-2 rounded-md bg-warning-tint px-space-3 py-space-2 text-[12.5px] text-ink-900">
            <p className="font-semibold">Open work — finish or cancel it before switching off:</p>
            <ul className="mt-1 list-disc pl-space-4">
              {m.open_work.map((w) => (
                <li key={w.key}>
                  {w.count} {w.label}
                  {w.amount_minor ? ` (${formatMoney(w.amount_minor, currency)})` : ""}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <Switch
        checked={m.enabled && !blocked}
        disabled={locked}
        aria-label={`${m.label} ${m.enabled ? "on" : "off"}`}
        onChange={onToggle}
      />
    </div>
  );
}
