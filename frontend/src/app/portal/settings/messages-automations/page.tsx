"use client";

import { useState } from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  ArrowLeft, Bell, Cake, Calendar, CalendarClock, CheckCircle2, Circle, Clock, Copy, Edit3, Headphones,
  Megaphone, MessageCircle, MoreHorizontal, Plus, Power, Search, Send, ShoppingCart, UserX, XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { PageHeader } from "@/components/ui/PageHeader";
import { PortalShell } from "@/components/portal/PortalShell";
import { StatTile } from "@/components/portal/StatTile";
import { WhatsAppIcon } from "@/components/portal/WhatsAppIcon";
import { usePortalGuard } from "@/components/portal/usePortalGuard";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast";

// ---------------------------------------------------------------------------------------------
// PREVIEW ONLY. Every value on this page is static, hardcoded demo data -- nothing here is
// fetched from the backend or written to the database. There is no Meta message-template system,
// no delivery-status tracking, and no automation rule engine in this app yet -- see docs/Spec.md's
// "Messages & Automations (planned — not yet built)" note for what real would actually require
// and the order it'd need to be built in. Confirmed with the user: build the look now, the
// substance later.
// ---------------------------------------------------------------------------------------------

function comingSoon(label: string) {
  toast.success(`${label} — coming soon`, "This page is a visual preview. See docs/Spec.md for the real build plan.");
}

const CATEGORY_TABS = [
  { key: "all", label: "All Templates", count: 24 },
  { key: "booking", label: "Booking Automations", count: 6 },
  { key: "order", label: "Order Automations", count: 7 },
  { key: "support", label: "Support Automations", count: 5 },
  { key: "promotions", label: "Promotions", count: 6 },
] as const;

type Template = {
  id: number;
  name: string;
  category: "booking" | "order" | "support" | "promotions";
  categoryLabel: string;
  icon: typeof Calendar;
  messageType: "Transactional" | "Marketing" | "Utility";
  status: "Active" | "Paused";
  approval: "Approved" | "Pending";
  lastUpdated: string;
  preview: string;
};

const TEMPLATES: Template[] = [
  { id: 1, name: "booking_confirmation", category: "booking", categoryLabel: "Booking", icon: Calendar, messageType: "Transactional", status: "Active", approval: "Approved", lastUpdated: "28 Apr 2025", preview: "Hi {{1}}! 👋\n\nYour table booking is confirmed! 🎉\n\n📅 Date: {{2}}\n🕐 Time: {{3}}\n👥 Guests: {{4}}\n\nWe look forward to serving you!\n- {{5}}" },
  { id: 2, name: "booking_reminder", category: "booking", categoryLabel: "Booking", icon: CalendarClock, messageType: "Transactional", status: "Active", approval: "Approved", lastUpdated: "26 Apr 2025", preview: "Hi {{1}}, just a reminder — your table for {{2}} is booked today at {{3}}. See you soon! 🍽️" },
  { id: 3, name: "order_confirmation", category: "order", categoryLabel: "Order", icon: ShoppingCart, messageType: "Transactional", status: "Active", approval: "Approved", lastUpdated: "25 Apr 2025", preview: "Order {{1}} confirmed! ✅\n\nTotal: {{2}}\nWe'll notify you once it's ready." },
  { id: 4, name: "order_out_for_delivery", category: "order", categoryLabel: "Order", icon: ShoppingCart, messageType: "Transactional", status: "Active", approval: "Approved", lastUpdated: "24 Apr 2025", preview: "Your order {{1}} is out for delivery 🛵 — arriving in ~{{2}} mins." },
  { id: 5, name: "feedback_request", category: "support", categoryLabel: "Support", icon: Headphones, messageType: "Utility", status: "Active", approval: "Approved", lastUpdated: "22 Apr 2025", preview: "Thanks for visiting, {{1}}! How was your experience? Reply with a rating 1-5 ⭐" },
  { id: 6, name: "special_offer_weekend", category: "promotions", categoryLabel: "Promotions", icon: Megaphone, messageType: "Marketing", status: "Active", approval: "Approved", lastUpdated: "20 Apr 2025", preview: "🎉 Weekend Special! Get 20% off this weekend with code WEEKEND20. Valid till Sunday." },
  { id: 7, name: "table_available", category: "booking", categoryLabel: "Booking", icon: Bell, messageType: "Transactional", status: "Paused", approval: "Approved", lastUpdated: "18 Apr 2025", preview: "Good news {{1}}! A table just opened up for your requested time. Reply YES to confirm." },
  { id: 8, name: "abandoned_cart", category: "order", categoryLabel: "Order", icon: ShoppingCart, messageType: "Marketing", status: "Active", approval: "Pending", lastUpdated: "16 Apr 2025", preview: "You left some tasty items in your cart 🛒 Complete your order before they're gone!" },
];

const AUTOMATION_STEPS = [
  { icon: Calendar, tone: "success", label: "Trigger", detail: "New booking created" },
  { icon: Clock, tone: "warning", label: "Delay", detail: "Wait 1 minute" },
  { icon: MessageCircle, tone: "brand", label: "Send WhatsApp Message", detail: "booking_confirmation" },
  { icon: CheckCircle2, tone: "info", label: "End", detail: "Workflow complete" },
] as const;

const STEP_TONE: Record<string, string> = {
  success: "bg-success-tint text-success border-success/20",
  warning: "bg-warning-tint text-warning border-warning/20",
  brand: "bg-brand-50 text-brand-700 border-brand-200",
  info: "bg-info-tint text-info border-info/20",
};

const ANALYTICS_TREND = [
  { label: "22 Apr", sent: 620, delivered: 590, failed: 40, replied: 190 },
  { label: "23 Apr", sent: 480, delivered: 460, failed: 20, replied: 150 },
  { label: "24 Apr", sent: 700, delivered: 665, failed: 30, replied: 210 },
  { label: "25 Apr", sent: 640, delivered: 605, failed: 45, replied: 230 },
  { label: "26 Apr", sent: 780, delivered: 745, failed: 25, replied: 260 },
  { label: "27 Apr", sent: 820, delivered: 790, failed: 35, replied: 280 },
  { label: "28 Apr", sent: 1248, delivered: 1180, failed: 22, replied: 525 },
];

type TriggerRow = { icon: typeof Calendar; event: string; sub?: string; automation: string; status: "Active" | "Paused" };
const TRIGGER_ROWS: TriggerRow[] = [
  { icon: Calendar, event: "New Booking Created", automation: "Send confirmation", status: "Active" },
  { icon: Clock, event: "Booking Reminder", sub: "(2 hours before)", automation: "Send reminder", status: "Active" },
  { icon: ShoppingCart, event: "Order Placed", automation: "Send confirmation", status: "Active" },
  { icon: Send, event: "Order Out for Delivery", automation: "Send update", status: "Active" },
  { icon: Headphones, event: "Support Ticket Created", automation: "Send acknowledgement", status: "Active" },
  { icon: MessageCircle, event: "Feedback Received", automation: "Send thank you", status: "Active" },
  { icon: UserX, event: "Inactive Customer", sub: "(7 days)", automation: "Send re-engagement offer", status: "Paused" },
  { icon: Cake, event: "Birthday (from profile)", automation: "Send special offer", status: "Active" },
];

export default function PortalMessagesAutomationsPage() {
  const { hospital, ready } = usePortalGuard();
  const [tab, setTab] = useState<(typeof CATEGORY_TABS)[number]["key"]>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Template>(TEMPLATES[0]);
  const [workflow, setWorkflow] = useState("Booking Confirmation Flow");

  const visibleTemplates = TEMPLATES.filter((t) => (tab === "all" || t.category === tab) && (!search.trim() || t.name.toLowerCase().includes(search.trim().toLowerCase())));

  return (
    <PortalShell hospital={hospital} active="settings">
      <PageHeader
        title="Messages & Automations"
        icon={<WhatsAppIcon size={22} />}
        description="Engage your customers with automated WhatsApp messages, templates and workflows."
        actions={<Button href="/portal/settings" variant="secondary"><ArrowLeft size={14} /> Back to settings</Button>}
      />

      <div className="mb-space-3 rounded-md border border-warning/30 bg-warning-tint px-space-3 py-space-2 text-[12.5px] font-medium text-warning">
        Preview only — templates, workflows and analytics below are illustrative demo data, not real yet. See docs/Spec.md for the build plan.
      </div>

      <div className="mb-space-4 grid grid-cols-1 gap-space-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile icon={<MessageCircle size={22} />} label="Active templates" value={24} deltaPct={20} tone="brand" filled />
        <StatTile icon={<Power size={22} />} label="Live automations" value={8} deltaPct={33} tone="warning" filled />
        <StatTile icon={<Send size={22} />} label="Messages sent today" value={1248} deltaPct={18} tone="info" filled />
        <StatTile icon={<CheckCircle2 size={22} />} label="Delivery rate" value={98.2} deltaPct={2} tone="success" filled />
        <StatTile icon={<XCircle size={22} />} label="Failed messages" value={22} deltaPct={-45} tone="clay" filled upIsGood={false} />
      </div>

      <div className="mb-space-4 flex flex-wrap items-center gap-space-2">
        {CATEGORY_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={cn(
              "rounded-md px-space-3 py-2 text-[13px] font-semibold transition-colors duration-150",
              tab === t.key ? "bg-brand-600 text-white" : "border border-line bg-card text-ink-600 hover:bg-paper",
            )}
          >
            {t.label} ({t.count})
          </button>
        ))}
        <div className="relative ml-auto w-full max-w-[220px]">
          <Search size={14} className="pointer-events-none absolute left-space-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <Input placeholder="Search templates…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Button onClick={() => comingSoon("Create Template")}>
          <Plus size={15} /> Create Template
        </Button>
      </div>

      <div className="mb-space-4 grid grid-cols-1 gap-space-4 xl:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          <div className="mb-space-3">
            <h3 className="text-[15px] font-bold text-ink-900">Template Library</h3>
            <p className="text-hint">Manage your WhatsApp message templates and automation workflows.</p>
          </div>
          <Card className="overflow-x-auto p-space-2">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="text-label border-b border-line text-ink-600">
                  <th className="px-space-3 py-space-2 font-medium">Template Name</th>
                  <th className="px-space-3 py-space-2 font-medium">Category</th>
                  <th className="px-space-3 py-space-2 font-medium">Message Type</th>
                  <th className="px-space-3 py-space-2 font-medium">Status</th>
                  <th className="px-space-3 py-space-2 font-medium">Approval</th>
                  <th className="px-space-3 py-space-2 font-medium">Last Updated</th>
                  <th className="px-space-3 py-space-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {visibleTemplates.map((t) => {
                  const Icon = t.icon;
                  return (
                    <tr
                      key={t.id}
                      onClick={() => setSelected(t)}
                      className={cn("cursor-pointer border-b border-line last:border-0 hover:bg-paper", selected.id === t.id && "bg-brand-50/60")}
                    >
                      <td className="px-space-3 py-space-2 font-mono font-semibold text-ink-900">{t.name}</td>
                      <td className="px-space-3 py-space-2 text-ink-700"><span className="inline-flex items-center gap-1"><Icon size={13} /> {t.categoryLabel}</span></td>
                      <td className="px-space-3 py-space-2 text-ink-600">{t.messageType}</td>
                      <td className="px-space-3 py-space-2"><Badge tone={t.status === "Active" ? "success" : "warning"}>{t.status}</Badge></td>
                      <td className="px-space-3 py-space-2">
                        <span className={cn("inline-flex items-center gap-1 text-[12px] font-semibold", t.approval === "Approved" ? "text-success" : "text-warning")}>
                          {t.approval === "Approved" ? <CheckCircle2 size={13} /> : <Clock size={13} />} {t.approval}
                        </span>
                      </td>
                      <td className="px-space-3 py-space-2 whitespace-nowrap text-ink-600">{t.lastUpdated}</td>
                      <td className="px-space-3 py-space-2 text-right" onClick={(e) => e.stopPropagation()}>
                        <button type="button" onClick={() => comingSoon(`Actions for ${t.name}`)} className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-600 hover:bg-black/4 hover:text-ink-900">
                          <MoreHorizontal size={16} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </div>

        <div className="min-w-0">
          <Card className="p-space-4">
            <div className="mb-space-3 flex items-center justify-between">
              <h3 className="text-[15px] font-bold text-ink-900">Template Preview</h3>
              <Badge tone={selected.approval === "Approved" ? "success" : "warning"}>{selected.approval}</Badge>
            </div>
            <div className="mb-space-3 flex items-center justify-between">
              <span className="font-mono text-[13px] font-semibold text-ink-900">{selected.name}</span>
              <Badge tone="brand">{selected.messageType}</Badge>
            </div>
            <div
              className="mb-space-3 rounded-lg p-space-3"
              style={{ backgroundColor: "#e9ddc9", backgroundImage: "radial-gradient(rgba(42,33,28,0.04) 1px, transparent 1px)", backgroundSize: "16px 16px" }}
            >
              <div className="max-w-[85%] rounded-lg bg-[#dcf8c6] px-space-3 py-space-2 text-[13px] text-ink-900 shadow-[var(--shadow-sm)]">
                <p className="whitespace-pre-wrap">{selected.preview}</p>
                <p className="mt-space-1 text-right text-[10.5px] text-ink-600">7:20 PM</p>
              </div>
            </div>
            <p className="mb-space-4 flex items-center gap-1 text-[11.5px] text-ink-400">
              <Circle size={6} className="fill-ink-400" /> This is a WhatsApp template preview. Dynamic values like {"{{1}}"} would be replaced with customer information.
            </p>
            <div className="grid grid-cols-2 gap-space-2">
              <Button variant="secondary" onClick={() => comingSoon("Edit Template")}><Edit3 size={14} /> Edit Template</Button>
              <Button variant="secondary" onClick={() => comingSoon("Send Test")}><Send size={14} /> Send Test</Button>
              <Button variant="secondary" onClick={() => comingSoon("Duplicate")}><Copy size={14} /> Duplicate</Button>
              <Button variant="destructive" onClick={() => comingSoon("Disable")}><Power size={14} /> Disable</Button>
            </div>
          </Card>
        </div>
      </div>

      <div className="mb-space-4 grid grid-cols-1 gap-space-4 xl:grid-cols-3">
        <Card className="p-space-4">
          <div className="mb-space-3 flex items-center justify-between">
            <h3 className="text-[15px] font-bold text-ink-900">Automation Workflow</h3>
            <Badge tone="success">Active</Badge>
          </div>
          <select
            value={workflow}
            onChange={(e) => setWorkflow(e.target.value)}
            className="mb-space-3 h-10 w-full rounded-md border border-line bg-card px-space-3 text-[13px] text-ink-900"
          >
            <option>Booking Confirmation Flow</option>
            <option>Order Update Flow</option>
            <option>Feedback Request Flow</option>
            <option>Re-engagement Flow</option>
          </select>
          <div className="space-y-space-2">
            {AUTOMATION_STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.label}>
                  <div className={cn("flex items-center gap-space-3 rounded-md border px-space-3 py-space-2", STEP_TONE[step.tone])}>
                    <Icon size={16} />
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold">{step.label}</p>
                      <p className="text-[11.5px] opacity-80">{step.detail}</p>
                    </div>
                  </div>
                  {i < AUTOMATION_STEPS.length - 1 && <div className="mx-auto h-4 w-px bg-line" />}
                </div>
              );
            })}
          </div>
          <Button variant="secondary" className="mt-space-3 w-full" onClick={() => comingSoon("Edit Flow")}>
            <Edit3 size={14} /> Edit Flow
          </Button>
        </Card>

        <Card className="p-space-4">
          <div className="mb-space-3 flex items-center justify-between">
            <h3 className="text-[15px] font-bold text-ink-900">Performance Analytics</h3>
            <span className="text-hint">Last 7 days</span>
          </div>
          <div className="mb-space-3 grid grid-cols-3 gap-space-2 text-center">
            <div className="rounded-md bg-paper px-space-2 py-space-2">
              <p className="text-[16px] font-bold text-ink-900">1,248</p>
              <p className="text-[11px] text-ink-600">Messages Sent</p>
            </div>
            <div className="rounded-md bg-paper px-space-2 py-space-2">
              <p className="text-[16px] font-bold text-success">98.2%</p>
              <p className="text-[11px] text-ink-600">Delivery Rate</p>
            </div>
            <div className="rounded-md bg-paper px-space-2 py-space-2">
              <p className="text-[16px] font-bold text-ink-900">42%</p>
              <p className="text-[11px] text-ink-600">Response Rate</p>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <LineChart data={ANALYTICS_TREND} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <CartesianGrid stroke="#ebe0d6" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={{ stroke: "#ebe0d6" }} tick={{ fontSize: 10, fill: "#6b5f56" }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: "#6b5f56" }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: "var(--line)" }} />
              <Line type="monotone" dataKey="sent" stroke="#2f6fed" strokeWidth={2} dot={false} name="Sent" />
              <Line type="monotone" dataKey="delivered" stroke="#22c55e" strokeWidth={2} dot={false} name="Delivered" />
              <Line type="monotone" dataKey="failed" stroke="#ef4444" strokeWidth={2} dot={false} name="Failed" />
              <Line type="monotone" dataKey="replied" stroke="#f59e0b" strokeWidth={2} dot={false} name="Replied" />
            </LineChart>
          </ResponsiveContainer>
          <div className="mt-space-2 grid grid-cols-3 gap-space-2 text-center text-[11px]">
            <div><p className="font-bold text-success">1,180</p><p className="text-ink-600">Delivered</p></div>
            <div><p className="font-bold text-info">525</p><p className="text-ink-600">Customer Replied</p></div>
            <div><p className="font-bold text-error">22</p><p className="text-ink-600">Failed</p></div>
          </div>
        </Card>

        <Card className="p-space-4">
          <div className="mb-space-3 flex items-center justify-between">
            <h3 className="text-[15px] font-bold text-ink-900">Trigger &amp; Event Mapping</h3>
            <Button variant="secondary" size="md" onClick={() => comingSoon("Add Trigger")}><Plus size={14} /> Add Trigger</Button>
          </div>
          <ul className="divide-y divide-line">
            {TRIGGER_ROWS.map((r) => {
              const Icon = r.icon;
              return (
                <li key={r.event} className="flex items-center gap-space-3 py-space-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600"><Icon size={14} /></span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-semibold text-ink-900">{r.event} {r.sub && <span className="font-normal text-ink-400">{r.sub}</span>}</p>
                    <p className="text-[11.5px] text-ink-600">{r.automation}</p>
                  </div>
                  <Badge tone={r.status === "Active" ? "success" : "warning"}>{r.status}</Badge>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </PortalShell>
  );
}
